from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BridgeConfiguration(StrictModel):
    adapter: Literal["epson-tm-l90-usb"] = "epson-tm-l90-usb"
    profile_id: Literal["80mm-576", "58mm-420"] = "80mm-576"


class ConfigurationRequest(StrictModel):
    adapter: Literal["epson-tm-l90-usb"]
    profileId: Literal["80mm-576", "58mm-420"]


class PrintMetadata(StrictModel):
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
    def document_version_is_supported(cls, value: dict) -> dict:
        if value.get("schemaVersion") not in (1, 2):
            raise ValueError("only receipt schema versions 1 and 2 are supported")
        return value


class Actor(StrictModel):
    kind: Literal["human", "webmcp", "api", "mcp", "system"]
    label: str | None = Field(default=None, max_length=120)
    clientId: str | None = Field(default=None, max_length=120)


class ReceiptSource(StrictModel):
    kind: Literal["template"]
    id: str = Field(min_length=1, max_length=120)
    revision: int = Field(ge=1)


class ReceiptCommitRequest(StrictModel):
    mutationId: UUID
    expectedRevision: int | None = Field(default=None, ge=0)
    proposedRevision: int = Field(ge=0)
    document: dict[str, Any]
    source: ReceiptSource | None = None
    actor: Actor
    summary: str | None = Field(default=None, max_length=240)


class SettingsUpdateRequest(StrictModel):
    mutationId: UUID
    expectedRevision: int = Field(ge=0)
    configured: bool
    printPolicy: Literal["confirm", "approved", "autonomous"]
    trustedTemplateIds: list[str] = Field(default_factory=list, max_length=100)
    defaultLocation: str = Field(default="", max_length=120)
    defaultUnit: Literal["fahrenheit", "celsius"] = "celsius"
    actor: Actor


class PrintRequester(StrictModel):
    kind: Literal["human", "webmcp", "api", "mcp", "system"]
    label: str | None = Field(default=None, max_length=120)
    clientId: str | None = Field(default=None, max_length=120)


class PrintRequestMetadata(StrictModel):
    id: UUID
    mutationId: UUID
    checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    rendererVersion: str = Field(min_length=1, max_length=80)
    expectedRevision: int = Field(ge=0)
    requester: PrintRequester
    reason: str | None = Field(default=None, max_length=500)
    width: int = Field(ge=240, le=640)
    height: int = Field(ge=1, le=10_000)
    feedLines: int = Field(default=4, ge=0, le=20)
    cutMode: Literal["full", "partial"] = "full"


class PrintDecisionRequest(StrictModel):
    mutationId: UUID
    decision: Literal["approve", "reject"]
    actor: Actor
