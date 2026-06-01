#!/bin/bash
#
# @rmoff / 2025-03-19

# Create a temporary file for the JSON output
temp_file=$(mktemp)

# Run the DuckDB query and save the output to the temp file
duckdb -json ~/.duckdb/extension_data/ui/ui.db \
        -c 'select title,json from ui.main.notebook_versions where expires is null' \
        | grep -v "^Run Time" > "$temp_file"

# Create a directory with timestamp for the output
timestamp=$(date +"%Y%m%d_%H%M%S")
output_dir="DuckDB_notebooks_${timestamp}"
mkdir -p "$output_dir"

# Process the JSON output
jq -c '.[]' "$temp_file" | while read -r item; do

    # Extract title
    title=$(echo "$item" | jq -r '.title')

    # Create a sanitized filename from the title
    # Replace spaces with underscores and remove special characters
    filename=$(echo "$title" | tr ' ' '_' | tr -cd 'a-zA-Z0-9_-').sql

    # Extract all queries from the notebook JSON and save them to the file
    # Credit to Hayley Jane Wakenshaw for the Duck ASCII art :)
    echo "$item" | jq -r '.json' | jq -r '.cells[] | "\n--           _      _      _\n--         >(.)__ <(.)__ =(.)__\n--          (___/  (___/  (___/ \n-- °º¤ø,¸¸,ø¤º°`°º¤ø,¸,ø¤°º¤ø,¸¸,ø¤º°`°º¤ø,¸\n\n" + .query' > "$output_dir/${filename}"

    echo "Created file: $filename"
done

# Clean up the temporary file
rm "$temp_file"

echo "All notebook queries have been saved to individual files in folder $output_dir."
echo ""
echo "To create a new gist run: gh gist create --desc \"DuckDB UI Notebook export $timestamp\" $output_dir/*.sql"