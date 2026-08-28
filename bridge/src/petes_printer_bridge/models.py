from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class BridgeConfiguration(BaseModel):
    adapter: Literal["epson-tm-l90-usb"] = "epson-tm-l90-usb"
    profile_id: Literal["80mm-576", "58mm-420"] = "80mm-576"


class ConfigurationRequest(BaseModel):
    adapter: Literal["epson-tm-l90-usb"]
    profileId: Literal["80mm-576", "58mm-420"]


class PrintMetadata(BaseModel):
    id: UUID
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    rendererVersion: str = Field(min_length=1, max_length=80)
    document: dict
    width: int = Field(ge=240, le=640)
    height: int = Field(ge=1, le=10_000)
    feedLines: int = Field(default=4, ge=0, le=20)
    cutMode: Literal["full", "partial"] = "full"

    @field_validator("document")
    @classmethod
    def document_is_v1(cls, value: dict) -> dict:
        if value.get("schemaVersion") != 1:
            raise ValueError("only receipt schema version 1 is supported")
        return value
