from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

class RiskContext(BaseModel):
    user_id: int
    user_role: str
    action: str
    document_id: Optional[UUID] = None
    document_classification: Optional[str] = "INTERNAL"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[UUID] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class FactorEvaluation(BaseModel):
    score: float
    weight: float
    weighted_score: float
    explanation: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RiskResult(BaseModel):
    risk_score: float
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    decision: str    # ALLOW, STEP_UP_AUTH, RESTRICT, BLOCK
    reason: str
    factors: Dict[str, FactorEvaluation]
    policy_id: int
    policy_snapshot: Dict[str, Any]
    event_id: Optional[UUID] = None
    step_up_challenge_id: Optional[UUID] = None

class StepUpVerifyRequest(BaseModel):
    challenge_id: UUID
    otp: str
