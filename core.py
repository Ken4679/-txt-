# -*- coding: utf-8 -*-
"""
Core processing module for ZipToTxt (Enhanced Security, High Fault-Tolerance & Accurate Token Estimation)
Provides backward compatibility facade for the modular core package.
"""

from core.constants import (
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_ZIP_SINGLE_FILE_BYTES,
    MAX_AI_INPUT_BYTES,
    MAX_AI_FILES,
    MAX_AI_TOTAL_OUTPUT_BYTES,
    MAX_AI_SINGLE_OUTPUT_BYTES,
    TEXT_EXTENSIONS,
    TEXT_FILENAMES,
    SENSITIVE_FILE_NAMES,
    SENSITIVE_DIR_NAMES,
    WINDOWS_RESERVED_NAMES,
    IGNORED_METADATA_FILES,
    COMMON_IGNORE_FOLDERS,
    AI_PRIMARY_PROMPT,
    AI_CONTINUE_PROMPT,
    AI_REVIEW_PROMPT,
    AI_AUDIT_PROMPT_CN,
    AI_AUDIT_PROMPT_EN,
)

from core.models import (
    SecurityError,
    ZipSecurityConfig,
    ZipFileEntry,
    ParsedAiBlock,
    TokenStats,
    ParseResult,
    RepoContextResult,
)

from core.security import (
    normalize_ai_path,
    is_safe_relative_path,
    is_sensitive_path,
    is_ignored_metadata_path,
    human_size,
    calculate_sha256,
)

from core.text import (
    is_binary_data,
    is_text_file,
    decode_text,
    get_file_language,
)

from core.token import (
    estimate_tokens,
    estimate_tokens_detailed,
)

from core.archive import (
    safe_extract_zip,
    generate_ascii_tree,
    scan_and_format_repo,
)

from core.parser import (
    parse_ai_blocks,
    parse_ai_output,
)

from core.patch import (
    create_patch_zip,
    write_parsed_files_to_dir,
)

__all__ = [
    "MAX_ZIP_BYTES",
    "MAX_ZIP_MEMBERS",
    "MAX_ZIP_UNCOMPRESSED_BYTES",
    "MAX_ZIP_SINGLE_FILE_BYTES",
    "MAX_AI_INPUT_BYTES",
    "MAX_AI_FILES",
    "MAX_AI_TOTAL_OUTPUT_BYTES",
    "MAX_AI_SINGLE_OUTPUT_BYTES",
    "TEXT_EXTENSIONS",
    "TEXT_FILENAMES",
    "SENSITIVE_FILE_NAMES",
    "SENSITIVE_DIR_NAMES",
    "WINDOWS_RESERVED_NAMES",
    "IGNORED_METADATA_FILES",
    "COMMON_IGNORE_FOLDERS",
    "AI_PRIMARY_PROMPT",
    "AI_CONTINUE_PROMPT",
    "AI_REVIEW_PROMPT",
    "AI_AUDIT_PROMPT_CN",
    "AI_AUDIT_PROMPT_EN",
    "SecurityError",
    "ZipSecurityConfig",
    "ZipFileEntry",
    "ParsedAiBlock",
    "TokenStats",
    "ParseResult",
    "RepoContextResult",
    "normalize_ai_path",
    "is_safe_relative_path",
    "is_sensitive_path",
    "is_ignored_metadata_path",
    "human_size",
    "calculate_sha256",
    "is_binary_data",
    "is_text_file",
    "decode_text",
    "get_file_language",
    "estimate_tokens",
    "estimate_tokens_detailed",
    "safe_extract_zip",
    "generate_ascii_tree",
    "scan_and_format_repo",
    "parse_ai_blocks",
    "parse_ai_output",
    "create_patch_zip",
    "write_parsed_files_to_dir",
]

def main():
    """CLI entrypoint for ZipToTxt command-line execution."""
    import argparse
    import sys
    import os

    parser = argparse.ArgumentParser(
        prog="ziptotxt",
        description="ZipToTxt - Convert code repositories (ZIP/Dir) to AI context TXT, or apply AI Markdown patches."
    )
    subparsers = parser.add_subparsers(dest="command", help="Available sub-commands")

    # Command 1: convert (zip/dir -> ai context txt)
    convert_parser = subparsers.add_parser("convert", help="Convert ZIP or code directory to structured AI context TXT")
    convert_parser.add_argument("input_path", help="Path to input ZIP archive or project root folder")
    convert_parser.add_argument("-o", "--output", help="Path to output text file (default: stdout or <input>_context.txt)")
    convert_parser.add_argument("--include-binary", action="store_true", help="Include binary files in base64 format")
    convert_parser.add_argument("--no-filter", action="store_true", help="Do not filter common ignore folders (node_modules, etc.)")
    convert_parser.add_argument("--ignore", action="append", help="Additional folder/file names to ignore (can specify multiple times)")

    # Command 2: patch (ai markdown -> patch zip)
    patch_parser = subparsers.add_parser("patch", help="Parse AI markdown response and generate patch.zip or apply to directory")
    patch_parser.add_argument("ai_input", help="Path to text file containing AI Markdown response (or '-' for stdin)")
    patch_parser.add_argument("-o", "--output-zip", help="Path to generate Patch ZIP file (e.g. patch.zip)")
    patch_parser.add_argument("--apply-to", help="Directory path to directly apply and overwrite modified files")
    patch_parser.add_argument("--allow-sensitive", action="store_true", help="Allow writing/packing sensitive credential files (.env, keys)")

    # Command 3: tokens (estimate tokens for text or repo)
    token_parser = subparsers.add_parser("tokens", help="Estimate multi-model Token budget for a text file or repo")
    token_parser.add_argument("file_path", help="Path to text file or ZIP archive")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "convert":
        input_path = os.path.abspath(args.input_path)
        if not os.path.exists(input_path):
            print(f"Error: Input path not found: {input_path}", file=sys.stderr)
            sys.exit(1)

        ignored = None
        if args.ignore:
            ignored = COMMON_IGNORE_FOLDERS + args.ignore

        filter_folders = not args.no_filter

        print(f"[*] Scanning repository: {input_path} ...", file=sys.stderr)
        try:
            txt_content, ascii_tree, metadata = scan_and_format_repo(
                input_path,
                include_binary=args.include_binary,
                filter_ignored_folders=filter_folders,
                ignored_folders=ignored,
            )

            out_path = args.output
            if not out_path:
                base_name = os.path.splitext(os.path.basename(input_path))[0]
                out_path = f"{base_name}_ai_context.txt"

            with open(out_path, "w", encoding="utf-8") as f:
                f.write(txt_content)

            print(f"[+] Success: Converted {metadata.get('file_count', 0)} files (~{metadata.get('estimated_tokens', 0):,} Tokens).", file=sys.stderr)
            print(f"[+] Output written to: {out_path}", file=sys.stderr)

        except Exception as e:
            print(f"[-] Error converting project: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "patch":
        if args.ai_input == "-":
            raw_text = sys.stdin.read()
        else:
            if not os.path.exists(args.ai_input):
                print(f"Error: AI input file not found: {args.ai_input}", file=sys.stderr)
                sys.exit(1)
            with open(args.ai_input, "r", encoding="utf-8", errors="replace") as f:
                raw_text = f.read()

        try:
            parse_result = parse_ai_output(raw_text)
            print(f"[*] Parsed {len(parse_result.blocks)} code blocks.", file=sys.stderr)

            if parse_result.warnings:
                for w in parse_result.warnings:
                    print(f"    [!] Warning: {w}", file=sys.stderr)

            if not parse_result.blocks:
                print("[-] No valid file code blocks found in input.", file=sys.stderr)
                sys.exit(1)

            files_dict = {b.relative_path: b.content for b in parse_result.blocks}

            if args.output_zip:
                create_patch_zip(files_dict, allow_sensitive=args.allow_sensitive, output_path=args.output_zip)
                print(f"[+] Generated patch archive: {args.output_zip}", file=sys.stderr)

            if args.apply_to:
                written = write_parsed_files_to_dir(files_dict, target_dir=args.apply_to, allow_sensitive=args.allow_sensitive)
                print(f"[+] Applied {len(written)} files directly to: {args.apply_to}", file=sys.stderr)

            if not args.output_zip and not args.apply_to:
                # Default to patch.zip in current dir
                def_out = "patch.zip"
                create_patch_zip(files_dict, allow_sensitive=args.allow_sensitive, output_path=def_out)
                print(f"[+] Generated patch archive: {def_out}", file=sys.stderr)

        except Exception as e:
            print(f"[-] Error generating patch: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "tokens":
        if not os.path.exists(args.file_path):
            print(f"Error: File not found: {args.file_path}", file=sys.stderr)
            sys.exit(1)

        with open(args.file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        stats = estimate_tokens_detailed(content)
        print(f"File: {args.file_path} ({human_size(len(content.encode('utf-8')))})")
        print(f"Characters: {stats.char_count:,} | Words: {stats.word_count:,} | Lines: {stats.line_count:,}")
        print("Model Token Estimates:")
        print(f"  • Claude (3.5 Sonnet / 3.7): ~{stats.claude_tokens:,} tokens")
        print(f"  • GPT-4o / GPT-4.5:          ~{stats.gpt4o_tokens:,} tokens")
        print(f"  • Gemini (2.0 / 1.5):        ~{stats.gemini_tokens:,} tokens")
        print(f"  • DeepSeek / Llama:          ~{stats.deepseek_tokens:,} tokens")


if __name__ == "__main__":
    main()
