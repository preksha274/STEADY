"""
Pytest configuration for the STEADY backend test-suite.

Redirects the DataStore / StorageService directories to a temporary location
*before* ``db.store`` is imported, so tests never write into the checked-in
``storage_db`` / ``storage_uploads`` folders.
"""

import os
import tempfile

_TEST_ROOT = tempfile.mkdtemp(prefix="steady_test_")
os.environ["STEADY_DATA_DIR"] = os.path.join(_TEST_ROOT, "storage_db")
os.environ["STEADY_STORAGE_DIR"] = os.path.join(_TEST_ROOT, "storage_uploads")
