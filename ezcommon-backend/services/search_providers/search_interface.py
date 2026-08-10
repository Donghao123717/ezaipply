"""Abstract interface that all search/storage providers must implement.

Reconstructed from services/search_providers/chromadb_provider.py, which is
the only concrete provider present in this repo and already calls every one
of these methods on `self` via inheritance.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class SearchProvider(ABC):
    """Common interface for document chunk storage/retrieval backends (ChromaDB, OpenSearch, ...)."""

    @abstractmethod
    def initialize(self) -> None:
        """Set up the underlying client/connection. Must be safe to call more than once."""
        raise NotImplementedError

    @abstractmethod
    def store_document(self, document_id: str, document: Dict[str, Any]) -> bool:
        """Store a parsed document's chunks.

        `document` is expected to contain: user_id, source_file, section,
        file_type, and information_chunks (a list of chunk dicts with at
        least a 'content' or 'text' field and a 'category' field).
        """
        raise NotImplementedError

    @abstractmethod
    def get_documents_by_user(self, user_id: str, section: Optional[str] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def get_all_chunks_for_user(self, user_id: str, section: Optional[str] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def is_available(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_provider_info(self) -> Dict[str, str]:
        raise NotImplementedError
