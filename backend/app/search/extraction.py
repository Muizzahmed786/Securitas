"""Extraction worker. Plaintext travels over pipes, never through temporary files."""

import io
import json
import re
import subprocess
import sys
import unicodedata
import zipfile
from pathlib import Path

MAX_BYTES = 20 * 1024 * 1024
MAX_TEXT = 2_000_000
MAX_WORDS = 100_000

WORD = re.compile(r"[^\W_]+", re.UNICODE)


def normalize_words(value: str) -> list[str]:
    value = unicodedata.normalize("NFKC", value).casefold()
    return sorted(set(WORD.findall(value)))


def extract_words(data: bytes, extension: str) -> list[str]:
    if len(data) > MAX_BYTES:
        raise ValueError("File too large")

    chunks: list[str] = []
    count = 0

    def add(value: str) -> None:
        nonlocal count

        count += len(value)
        if count > MAX_TEXT:
            raise ValueError("Text limit exceeded")

        chunks.append(value)

    if extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data), strict=False)

        if reader.is_encrypted:
            raise ValueError("Password-protected PDF")

        if len(reader.pages) > 500:
            raise ValueError("Page limit exceeded")

        for page in reader.pages:
            add(page.extract_text() or "")

    elif extension == ".docx":
        from defusedxml.ElementTree import fromstring

        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if len(archive.infolist()) > 2000:
                raise ValueError("Archive entry limit exceeded")

            # Include the body, headers, footers, footnotes and endnotes.
            names = [
                name
                for name in archive.namelist()
                if name == "word/document.xml"
                or re.fullmatch(
                    r"word/(header\d+|footer\d+|footnotes|endnotes)\.xml",
                    name,
                )
            ]

            if "word/document.xml" not in names:
                raise ValueError("Missing document body")

            expanded_size = sum(
                archive.getinfo(name).file_size for name in names
            )

            if expanded_size > 8 * 1024 * 1024:
                raise ValueError("Expanded XML limit exceeded")

            ns = (
                "{http://schemas.openxmlformats.org/"
                "wordprocessingml/2006/main}"
            )

            for name in names:
                root = fromstring(archive.read(name))

                for paragraph in root.iter(ns + "p"):
                    pieces: list[str] = []

                    # Runs can split one word, so do not insert spaces
                    # between ordinary text runs.
                    for node in paragraph.iter():
                        if node.tag == ns + "t":
                            pieces.append(node.text or "")
                        elif node.tag in (
                            ns + "tab",
                            ns + "br",
                            ns + "cr",
                        ):
                            pieces.append(" ")

                    add("".join(pieces))

    else:
        raise ValueError("Unsupported type")

    words = normalize_words("\n".join(chunks))

    if len(words) > MAX_WORDS:
        raise ValueError("Keyword limit exceeded")

    return words


def extraction_worker(
    data: bytes,
    filename: str,
) -> tuple[str, list[str]]:
    extension = Path(filename).suffix.lower()

    if extension not in (".pdf", ".docx"):
        return "UNSUPPORTED", []

    if len(data) > MAX_BYTES:
        return "FAILED", []

    try:
        result = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).resolve()),
                extension,
            ],
            input=data,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=20,
            check=True,
        )

        decoded = json.loads(result.stdout)

        if not isinstance(decoded, list):
            raise ValueError("Invalid extraction result")

        words: list[str] = []

        for item in decoded:
            if not isinstance(item, str):
                raise ValueError("Invalid extracted keyword")
            words.append(item)

        if len(words) > MAX_WORDS:
            raise ValueError("Keyword limit exceeded")

        return ("INDEXED" if words else "EMPTY"), words

    except (subprocess.SubprocessError, OSError, ValueError):
        return "FAILED", []


def main() -> int:
    # The resource module is available on Unix, but not Windows.
    if sys.platform != "win32":
        try:
            import resource

            memory_limit = 768 * 1024**2
            resource.setrlimit(
                resource.RLIMIT_AS,
                (memory_limit, memory_limit),
            )
        except (ImportError, OSError, ValueError):
            pass

    try:
        if len(sys.argv) != 2:
            return 1

        data = sys.stdin.buffer.read(MAX_BYTES + 1)
        words = extract_words(data, sys.argv[1])

        # Explicit UTF-8 output avoids platform-dependent pipe encoding.
        output = json.dumps(words, ensure_ascii=True).encode("utf-8")
        sys.stdout.buffer.write(output)
        return 0

    except Exception:
        # Do not print plaintext or parser exceptions.
        return 1


if __name__ == "__main__":
    sys.exit(main())