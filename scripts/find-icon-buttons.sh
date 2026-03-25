#!/bin/bash
# Find all icon-only buttons without aria-label

cd /home/ethan/.openclaw/workspace/automation-lab

echo "Searching for icon-only buttons without aria-label..."
echo ""

# Common Lucide icon names
ICONS="Trash2|Edit|X|Plus|ChevronDown|ChevronUp|ChevronLeft|ChevronRight|Settings|Download|Upload|Search|Filter|Eye|EyeOff|Calendar|Clock|User|Users|Tag|Tags|MapPin|Phone|Mail|ExternalLink|Copy|Check|Info|AlertCircle|HelpCircle|MoreVertical|MoreHorizontal|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Loader2|RefreshCw|Save|Trash|PenSquare|FileText|Menu|Home|LogOut|Grid|List|ChevronDoubleLeft|ChevronDoubleRight"

find app/tools/scheduler -name "*.tsx" -type f | while read file; do
    # Look for button tags
    grep -n "<button" "$file" | while IFS=: read -r line_num line_content; do
        # Get context around the button (next 5 lines)
        context=$(sed -n "${line_num},$((line_num + 5))p" "$file")
        
        # Check if it has an icon and no aria-label in the opening tag
        if echo "$context" | grep -qE "<($ICONS)\b" && ! echo "$line_content" | grep -q "aria-label"; then
            # Check if there's text content or just an icon
            if ! echo "$context" | grep -qE ">\s*[A-Za-z]{2,}"; then
                echo "$file:$line_num"
                echo "  $line_content" | sed 's/^[[:space:]]*/  /'
                echo ""
            fi
        fi
    done
done
