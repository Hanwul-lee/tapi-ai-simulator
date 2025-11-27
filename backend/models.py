# backend/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Persona(Base):
    __tablename__ = "persona"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    traits = Column(Text)          # JSON 문자열
    behavior_rules = Column(Text)  # JSON 문자열


class Scenario(Base):
    __tablename__ = "scenario"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False)
    description = Column(Text)
    checklist = Column(Text)       # JSON 문자열


class SimulationRun(Base):
    __tablename__ = "simulation_run"

    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("persona.id"), nullable=True)
    scenario_id = Column(Integer, ForeignKey("scenario.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    persona = relationship("Persona")
    scenario = relationship("Scenario")


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id = Column(Integer, primary_key=True, index=True)
    simulation_id = Column(Integer, ForeignKey("simulation_run.id"))
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "report"

    simulation_id = Column(Integer, ForeignKey("simulation_run.id"), primary_key=True)
    overview = Column(Text)
    strengths = Column(Text)
    improvements = Column(Text)
    advice = Column(Text)
    json_score = Column(Text)
