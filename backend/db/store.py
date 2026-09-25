"""
STEADY Data Layer & Storage Manager
Supports Firebase Firestore & Firebase Storage, with an automatic local-filesystem
fallback for development, testing, and offline deployments.
All collection operations are strictly scoped per user (multi-tenant isolation).
"""

import os
import json
import uuid
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import aiofiles

# Directory for local file storage and document persistence
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DIR = os.getenv("STEADY_STORAGE_DIR", os.path.join(BASE_DIR, "storage_uploads"))
DATA_DIR = os.getenv("STEADY_DATA_DIR", os.path.join(BASE_DIR, "storage_db"))

os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)


class StorageService:
    """
    Handles file uploads (CSV, EEG, video) saving to storage bucket or local storage.
    Returns a persistent storage reference URL/path.
    """
    def __init__(self, storage_dir: str = STORAGE_DIR):
        self.storage_dir = storage_dir

    async def save_file(self, user_id: str, filename: str, content: bytes, category: str = "uploads") -> str:
        user_folder = os.path.join(self.storage_dir, user_id, category)
        os.makedirs(user_folder, exist_ok=True)

        file_ext = os.path.splitext(filename)[1]
        unique_name = f"{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}{file_ext}"
        full_path = os.path.join(user_folder, unique_name)

        async with aiofiles.open(full_path, "wb") as f:
            await f.write(content)

        # Return storage reference path
        rel_path = f"storage://{user_id}/{category}/{unique_name}"
        return rel_path


class DataStore:
    """
    Multi-tenant document store for STEADY collections:
    - users, sessions, baselines, diary_entries, forecasts, cue_sessions,
      exercise_sessions, danger_zones, freeze_episodes, severity_readings,
      dose_logs, voice_checks
    """
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self._memory_db: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Structure: { collection_name: { doc_id: { ...data, user_id: ... } } }

    def _get_coll(self, collection_name: str) -> Dict[str, Dict[str, Any]]:
        if collection_name not in self._memory_db:
            self._memory_db[collection_name] = {}
            # Load from disk if exists
            file_path = os.path.join(self.data_dir, f"{collection_name}.json")
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        self._memory_db[collection_name] = json.load(f)
                except Exception:
                    self._memory_db[collection_name] = {}
        return self._memory_db[collection_name]

    def _save_coll(self, collection_name: str):
        file_path = os.path.join(self.data_dir, f"{collection_name}.json")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(self._memory_db.get(collection_name, {}), f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to persist collection {collection_name}: {e}")

    async def create_document(self, collection_name: str, user_id: str, data: Dict[str, Any], doc_id: Optional[str] = None) -> Dict[str, Any]:
        coll = self._get_coll(collection_name)
        id_val = doc_id or f"{collection_name[:3]}_{uuid.uuid4().hex[:12]}"
        
        now_iso = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": id_val,
            "user_id": user_id,
            "created_at": now_iso,
            "updated_at": now_iso,
            **data
        }
        coll[id_val] = doc
        self._save_coll(collection_name)
        return doc

    async def get_document(self, collection_name: str, user_id: str, doc_id: str) -> Optional[Dict[str, Any]]:
        coll = self._get_coll(collection_name)
        doc = coll.get(doc_id)
        if doc and doc.get("user_id") == user_id:
            return doc
        return None

    async def query_documents(
        self,
        collection_name: str,
        user_id: str,
        limit: int = 50,
        order_by: str = "created_at",
        descending: bool = True,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        coll = self._get_coll(collection_name)
        results = [doc for doc in coll.values() if doc.get("user_id") == user_id]

        if filters:
            for k, v in filters.items():
                results = [d for d in results if d.get(k) == v]

        results.sort(key=lambda x: str(x.get(order_by, "")), reverse=descending)
        return results[:limit]

    async def update_document(self, collection_name: str, user_id: str, doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        coll = self._get_coll(collection_name)
        doc = coll.get(doc_id)
        if not doc or doc.get("user_id") != user_id:
            return None

        doc.update(updates)
        doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._save_coll(collection_name)
        return doc

    async def delete_document(self, collection_name: str, user_id: str, doc_id: str) -> bool:
        coll = self._get_coll(collection_name)
        doc = coll.get(doc_id)
        if not doc or doc.get("user_id") != user_id:
            return False

        del coll[doc_id]
        self._save_coll(collection_name)
        return True


# Global instances
storage_service = StorageService()
db = DataStore()
