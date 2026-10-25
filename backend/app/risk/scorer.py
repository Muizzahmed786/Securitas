from typing import Dict, Any
from app.risk.schemas import FactorEvaluation, RiskResult

def score_risk(factors: Dict[str, FactorEvaluation], policy: Dict[str, Any]) -> tuple[float, str, str, str]:
    total_score = sum(factor.weighted_score for factor in factors.values())
    total_score = round(min(100.0, max(0.0, total_score)), 2)

    low_max = float(policy.get("low_max", 30.0))
    medium_max = float(policy.get("medium_max", 60.0))
    high_max = float(policy.get("high_max", 80.0))

    if total_score <= low_max:
        risk_level = "LOW"
        decision = "ALLOW"
        reason = f"Calculated risk score {total_score:.1f} is within normal operating threshold (LOW)."
    elif total_score <= medium_max:
        risk_level = "MEDIUM"
        decision = "ALLOW"
        reason = f"Calculated risk score {total_score:.1f} shows moderate deviation; access permitted under monitoring (MEDIUM)."
    elif total_score <= high_max:
        risk_level = "HIGH"
        decision = "STEP_UP_AUTH"
        reason = f"Calculated risk score {total_score:.1f} exceeds standard risk tolerance; step-up verification required (HIGH)."
    else:
        risk_level = "CRITICAL"
        decision = "BLOCK"
        reason = f"Calculated risk score {total_score:.1f} represents critical anomalous activity; operation blocked (CRITICAL)."

    return total_score, risk_level, decision, reason
