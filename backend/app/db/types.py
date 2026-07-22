"""Cross-database compatible types."""
import uuid
from sqlalchemy import String, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID


class TolerantEnum(TypeDecorator):
    """Store a Python enum as a string, tolerant of legacy name/value casing on read.

    Historically rows have been persisted using the enum *name* (e.g. ``MANUAL``),
    but stray rows using the *value* (e.g. ``manual``) have appeared via manual
    edits / imports. SQLAlchemy's plain ``Enum`` only accepts the exact stored
    form, so a single mismatched row raises ``LookupError`` and breaks the whole
    query. This type accepts either the name or the value in any casing when
    reading, so one bad row can never take down an entire listing.

    Writes are normalized to the enum ``name`` (uppercase), keeping storage
    consistent with the existing data and with equality filters. JSON output is
    unaffected: FastAPI still serializes the enum member to its (lowercase)
    value.
    """
    impl = String(50)
    cache_ok = True

    def __init__(self, enum_class, **kwargs):
        self.enum_class = enum_class
        super().__init__(**kwargs)

    def _coerce(self, value):
        if isinstance(value, self.enum_class):
            return value
        s = str(value).strip()
        # Exact match on name or value first.
        for member in self.enum_class:
            if s == member.name or s == member.value:
                return member
        # Fall back to case-insensitive match on either form.
        low = s.lower()
        for member in self.enum_class:
            if low == member.name.lower() or low == member.value.lower():
                return member
        raise LookupError(
            f"{value!r} is not a valid {self.enum_class.__name__}"
        )

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return self._coerce(value).name

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return self._coerce(value)


class GUID(TypeDecorator):
    """Platform-independent GUID type.

    Uses PostgreSQL's UUID type when available, otherwise uses
    String(36) to store as a standard UUID string.
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgresUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            else:
                return str(uuid.UUID(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid.UUID):
                return value
            else:
                return uuid.UUID(value)
