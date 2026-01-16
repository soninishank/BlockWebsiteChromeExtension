#!/bin/bash

# Name of the output file
OUTPUT_FILE="focus-flow-package.zip"

# Remove old package if it exists
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
fi

# Zip the contents
# Excluding: .git, .DS_Store, scripts/, and the zip file itself
zip -r "$OUTPUT_FILE" . -x "*.git*" -x "*.DS_Store" -x "scripts/*" -x "$OUTPUT_FILE" -x "*.md"

echo "✅ Package created: $OUTPUT_FILE"
echo "You can now upload this file to the Chrome Web Store."
