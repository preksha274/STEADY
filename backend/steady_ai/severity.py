"""
STEADY AI - Symptom Severity Meter Module
Blends objective baseline deviation (% change) with patient's 1–5 self-rating
into Mild/Moderate/High tiers.
Framed strictly as 'Compared to your usual' — never a clinical diagnosis or score.
"""

from typing import List, Dict, Any, Optional
from .types import (
    SymptomSeverityTier,
    SymptomSeverityResult,
    ConfidenceReport,
    ConfidenceTier,
    QualityIssue
)


def compute_symptom_severity(
    symptom_name: str,
    patient_rating_1_5: int,
    current_metric_value: float,
    baseline_metric_value: float,
    measurement_confidence: ConfidenceTier = ConfidenceTier.HIGH
) -> SymptomSeverityResult:
    """
    Combines subjective 1-5 rating (50% weight) with objective baseline deviation (50% weight).
    Outputs: Mild / Moderate / High relative to patient's usual baseline.
    """
    # 1. Compute baseline deviation %
    if baseline_metric_value > 0:
        dev_pct = ((current_metric_value - baseline_metric_value) / baseline_metric_value) * 100.0
    else:
        dev_pct = 0.0

    # 2. Convert deviation % to normalized 1-5 scale (0% deviation = 3.0 normal)
    # -30% or less -> 1.0 (much better than usual)
    # 0% -> 3.0 (typical)
    # +30% -> 4.0
    # +60% or more -> 5.0 (much more noticeable than usual)
    objective_scale = 3.0 + (dev_pct / 30.0)
    objective_scale = max(1.0, min(5.0, objective_scale))

    # 3. Composite blend (50% subjective check-in, 50% sensor deviation)
    composite_score = 0.50 * float(patient_rating_1_5) + 0.50 * objective_scale

    # 4. Map composite score to Severity Tier
    if composite_score <= 2.4:
        tier = SymptomSeverityTier.MILD
        tier_label = "Mild"
    elif composite_score <= 3.7:
        tier = SymptomSeverityTier.MODERATE
        tier_label = "Moderate"
    else:
        tier = SymptomSeverityTier.HIGH
        tier_label = "High"

    conf_report = ConfidenceReport(
        tier=measurement_confidence,
        primary_issue=QualityIssue.CLEAN_SIGNAL if measurement_confidence != ConfidenceTier.LOW else QualityIssue.HIGH_NOISE_OR_MOTION_ARTIFACT,
        reason=f"Derived from personal baseline ({dev_pct:+.1f}%) and check-in score ({patient_rating_1_5}/5)",
        numeric_score=0.90 if measurement_confidence == ConfidenceTier.HIGH else 0.70
    )

    return SymptomSeverityResult(
        symptom_name=symptom_name,
        patient_rating_1_5=patient_rating_1_5,
        baseline_deviation_pct=round(dev_pct, 1),
        computed_tier=tier,
        tier_label=tier_label,
        comparison_text="Compared to your usual",
        confidence=conf_report
    )
