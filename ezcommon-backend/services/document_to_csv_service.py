"""
Document to CSV Service
Generates statistics and CSV exports from a user's parsed document chunks
"""
import csv
import io
import os
from typing import Dict, Any, List, Optional


class DocumentToCSVService:
    """Service for exporting a user's parsed document chunks to CSV and statistics"""

    def __init__(self):
        """Initialize the document to CSV service

        Builds its own search provider internally from environment variables,
        the same way auth_api.py builds its module-level search provider.
        """
        self.search_provider = None

        try:
            from services.search_providers import SearchProviderFactory

            search_config = self._build_search_config()
            self.search_provider = SearchProviderFactory.create(search_config)
            self.search_provider.initialize()
            print(f"✓ Document CSV service: search provider initialized ({search_config.get('SEARCH_PROVIDER', 'opensearch')})")
        except Exception as e:
            print(f"⚠ Warning: Document CSV service search provider initialization failed: {e}")
            self.search_provider = None

    def _build_search_config(self) -> Dict[str, Any]:
        """Build search provider configuration from environment variables"""
        return {
            'SEARCH_PROVIDER': os.environ.get('SEARCH_PROVIDER', 'opensearch'),
            'OPENSEARCH_HOST': os.environ.get('OPENSEARCH_HOST'),
            'OPENSEARCH_REGION': os.environ.get('OPENSEARCH_REGION', 'us-east-1'),
            'OPENSEARCH_INDEX': os.environ.get('OPENSEARCH_INDEX', 'document_chunks'),
            'OPENSEARCH_PORT': int(os.environ.get('OPENSEARCH_PORT', '443')),
            'CHROMADB_DATA_DIR': os.environ.get('CHROMADB_DATA_DIR', './chroma_data'),
            'CHROMADB_COLLECTION_NAME': os.environ.get('CHROMADB_COLLECTION_NAME', 'document_chunks')
        }

    def _get_user_chunks(self, user_id: str, section: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve all document chunks for a user from the search provider"""
        if not self.search_provider:
            return []

        try:
            chunks = self.search_provider.get_all_chunks_for_user(user_id, section)
            return chunks or []
        except Exception as e:
            print(f"⚠ Error retrieving chunks for user {user_id}: {e}")
            return []

    @staticmethod
    def _chunk_content(chunk: Dict[str, Any]) -> str:
        """Extract textual content from a chunk, supporting both 'content' and 'text' keys"""
        return chunk.get('content') or chunk.get('text', '') or ''

    def get_statistics(self, user_id: str, section: Optional[str] = None) -> Dict[str, Any]:
        """
        Get statistics about a user's parsed documents

        Args:
            user_id: User ID
            section: Optional section filter

        Returns:
            Dictionary with document/chunk counts and category/section breakdowns
        """
        try:
            chunks = self._get_user_chunks(user_id, section)

            source_files = set()
            categories: Dict[str, int] = {}
            sections: Dict[str, int] = {}

            for chunk in chunks:
                source_file = chunk.get('source_file', 'unknown')
                source_files.add(source_file)

                category = chunk.get('category') or 'uncategorized'
                categories[category] = categories.get(category, 0) + 1

                chunk_section = chunk.get('section') or 'unknown'
                sections[chunk_section] = sections.get(chunk_section, 0) + 1

            return {
                "user_id": user_id,
                "section": section,
                "total_documents": len(source_files),
                "total_chunks": len(chunks),
                "categories": categories,
                "sections": sections,
            }
        except Exception as e:
            print(f"⚠ Error computing statistics for user {user_id}: {e}")
            return {
                "status": "error",
                "message": f"Failed to compute statistics: {str(e)}"
            }

    def generate_summary_csv(self, user_id: str, section: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a detailed CSV export (one row per chunk) for a user's documents

        Args:
            user_id: User ID
            section: Optional section filter

        Returns:
            On success: {"status": "success", "csv_content": str, "total_documents": int, "total_chunks": int}
            On failure/empty: {"status": "error", "message": str}
        """
        try:
            chunks = self._get_user_chunks(user_id, section)

            if not chunks:
                return {
                    "status": "error",
                    "message": "No documents found for user"
                }

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["source_file", "section", "category", "content"])

            source_files = set()
            for chunk in chunks:
                source_file = chunk.get('source_file', 'unknown')
                source_files.add(source_file)

                writer.writerow([
                    source_file,
                    chunk.get('section', 'unknown'),
                    chunk.get('category') or 'uncategorized',
                    self._chunk_content(chunk)
                ])

            csv_content = output.getvalue()
            output.close()

            print(f"✓ Generated summary CSV for user {user_id}: {len(chunks)} chunks, {len(source_files)} documents")

            return {
                "status": "success",
                "csv_content": csv_content,
                "total_documents": len(source_files),
                "total_chunks": len(chunks)
            }
        except Exception as e:
            print(f"⚠ Error generating summary CSV for user {user_id}: {e}")
            return {
                "status": "error",
                "message": f"Failed to generate CSV: {str(e)}"
            }

    def generate_categorized_csv(self, user_id: str, section: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a CSV export organized/grouped by category for a user's documents

        Args:
            user_id: User ID
            section: Optional section filter

        Returns:
            On success: {"status": "success", "csv_content": str, "total_documents": int, "total_categories": int}
            On failure/empty: {"status": "error", "message": str}
        """
        try:
            chunks = self._get_user_chunks(user_id, section)

            if not chunks:
                return {
                    "status": "error",
                    "message": "No documents found for user"
                }

            # Group chunks by category
            grouped: Dict[str, List[Dict[str, Any]]] = {}
            source_files = set()
            for chunk in chunks:
                category = chunk.get('category') or 'uncategorized'
                grouped.setdefault(category, []).append(chunk)
                source_files.add(chunk.get('source_file', 'unknown'))

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["category", "source_file", "section", "content"])

            # Sort categories alphabetically, and sort chunks within a category by source_file
            for category in sorted(grouped.keys()):
                category_chunks = sorted(
                    grouped[category],
                    key=lambda c: (c.get('source_file', 'unknown'), c.get('chunk_index', 0))
                )
                for chunk in category_chunks:
                    writer.writerow([
                        category,
                        chunk.get('source_file', 'unknown'),
                        chunk.get('section', 'unknown'),
                        self._chunk_content(chunk)
                    ])

            csv_content = output.getvalue()
            output.close()

            print(f"✓ Generated categorized CSV for user {user_id}: {len(grouped)} categories, {len(chunks)} chunks")

            return {
                "status": "success",
                "csv_content": csv_content,
                "total_documents": len(source_files),
                "total_categories": len(grouped)
            }
        except Exception as e:
            print(f"⚠ Error generating categorized CSV for user {user_id}: {e}")
            return {
                "status": "error",
                "message": f"Failed to generate CSV: {str(e)}"
            }
