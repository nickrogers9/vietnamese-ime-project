class VietnameseIME {
    constructor() {
        this.textarea = document.getElementById('vietnameseInput');
        this.suggestionOverlay = document.getElementById('suggestionOverlay');
        this.suggestionDropdown = document.getElementById('suggestionDropdown');
        this.suggestionList = document.getElementById('suggestionList');
        this.apiStatus = document.getElementById('apiStatus');
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        this.textPreview = document.getElementById('textPreview');
        
        // Settings
        this.autoSuggestEnabled = true;
        this.smartSpaceEnabled = true;
        this.suggestionDelay = 300;
        this.apiEndpoint = 'http://localhost:5000/predict';
        
        // State variables
        this.currentSuggestions = [];
        this.selectedSuggestionIndex = 0;
        this.lastRequestText = '';
        this.requestTimeout = null;
        this.isSuggestionVisible = false;
        this.currentSuggestionWord = '';
        
        // Initialize
        this.init();
        this.checkAPIStatus();
        
        // Store wrapper reference
        this.inputWrapper = document.querySelector('.input-wrapper');
    }
    
    init() {
        // Event listeners
        this.textarea.addEventListener('input', this.handleInput.bind(this));
        this.textarea.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.textarea.addEventListener('click', this.handleClick.bind(this));
        this.textarea.addEventListener('blur', this.hideSuggestion.bind(this));
        
        // Handle selection changes (cursor movement)
        this.textarea.addEventListener('keyup', this.handleCursorMove.bind(this));
        this.textarea.addEventListener('mouseup', this.handleCursorMove.bind(this));
        
        // Handle scroll to reposition suggestion
        this.textarea.addEventListener('scroll', () => {
            if (this.isSuggestionVisible) {
                this.updateSuggestionPosition();
            }
        });
        
        // Settings controls
        document.getElementById('autoSuggestToggle').addEventListener('change', (e) => {
            this.autoSuggestEnabled = e.target.checked;
            if (!this.autoSuggestEnabled) {
                this.hideSuggestion();
            }
        });
        
        document.getElementById('smartSpaceToggle').addEventListener('change', (e) => {
            this.smartSpaceEnabled = e.target.checked;
        });
        
        document.getElementById('suggestionDelay').addEventListener('input', (e) => {
            this.suggestionDelay = parseInt(e.target.value);
            document.getElementById('delayValue').textContent = this.suggestionDelay;
        });
        
        document.getElementById('closeDropdown').addEventListener('click', () => {
            this.hideDropdown();
        });
        
        // Update stats initially
        this.updateStats();
        
        // Set up periodic API status check
        setInterval(() => this.checkAPIStatus(), 30000);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.isSuggestionVisible) {
                this.updateSuggestionPosition();
            }
        });
    }
    
    isCursorAtCorrectPosition() {
        const cursorPosition = this.textarea.selectionStart;
        const text = this.textarea.value;
        
        // Check if cursor is at the end of text
        if (cursorPosition !== text.length) {
            return false;
        }
        
        // Check if text ends with exactly one space after last word
        if (!text.endsWith(' ')) {
            return false;
        }
        
        // Get text before the last space
        const textWithoutLastSpace = text.substring(0, text.length - 1);
        
        // Check if there's no space before the last space (exactly one space)
        if (textWithoutLastSpace.endsWith(' ')) {
            return false;
        }
        
        // Check if there's at least one word before the space
        const words = textWithoutLastSpace.trim().split(/\s+/);
        if (words.length === 0) {
            return false;
        }
        
        const lastWord = words[words.length - 1];
        
        // Check if last word is valid (has at least 2 characters and contains letters)
        return lastWord && lastWord.length >= 1 && /[a-zA-ZÀ-ỹ]/.test(lastWord);
    }
    
    handleCursorMove() {
        if (!this.isCursorAtCorrectPosition()) {
            this.hideSuggestion();
        } else {
            // If cursor is at correct position, we should show suggestion if we have one
            if (this.currentSuggestions.length > 0) {
                this.showSuggestion();
            } else {
                // Fetch suggestions if we don't have them yet
                const text = this.textarea.value.trim();
                this.fetchSuggestions(text);
            }
        }
    }
    
    async checkAPIStatus() {
        try {
            const response = await fetch('http://localhost:5000/health');
            if (response.ok) {
                this.apiStatus.textContent = 'Online';
                this.apiStatus.className = 'status-online';
            } else {
                throw new Error('API not healthy');
            }
        } catch (error) {
            console.log('API is offline:', error);
            this.apiStatus.textContent = 'Offline';
            this.apiStatus.className = 'status-offline';
        }
    }
    
    async fetchSuggestions(text) {
        if (!text.trim()) {
            this.currentSuggestions = [];
            this.hideSuggestion();
            return;
        }
        
        // Only fetch if cursor is at correct position
        if (!this.isCursorAtCorrectPosition()) {
            this.currentSuggestions = [];
            this.hideSuggestion();
            return;
        }
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text.trim() })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.predictions && data.predictions.length > 0) {
                this.currentSuggestions = data.predictions;
                this.currentSuggestionWord = this.currentSuggestions[0]?.word || '';
                if (this.isCursorAtCorrectPosition()) {
                    this.showSuggestion();
                }
            } else {
                this.currentSuggestions = [];
                this.hideSuggestion();
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            this.currentSuggestions = [];
            this.hideSuggestion();
        }
    }
    
    showSuggestion() {
        if (!this.autoSuggestEnabled || 
            this.currentSuggestions.length === 0 || 
            !this.isCursorAtCorrectPosition()) {
            this.hideSuggestion();
            return;
        }
        
        const topSuggestion = this.currentSuggestions[0];
        if (!topSuggestion) {
            this.hideSuggestion();
            return;
        }
        
        // Create suggestion element
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-text';
        suggestionElement.style.position = 'absolute';
        suggestionElement.style.whiteSpace = 'nowrap';
        suggestionElement.style.pointerEvents = 'none';
        suggestionElement.style.zIndex = '1000';
        
        // Normal suggestion display
        suggestionElement.innerHTML = `
            <span class="suggestion-fill">${topSuggestion.word}</span>
            <span class="dropdown-arrow">▼</span>
        `;
        
        // Position the suggestion overlay at cursor position
        this.positionSuggestionAtCursor(suggestionElement);
        
        // Clear and add new suggestion
        this.suggestionOverlay.innerHTML = '';
        this.suggestionOverlay.appendChild(suggestionElement);
        this.isSuggestionVisible = true;
    }
    
    updateSuggestionPosition() {
        if (this.isSuggestionVisible && this.currentSuggestions.length > 0) {
            const suggestionElement = this.suggestionOverlay.querySelector('.suggestion-text');
            if (suggestionElement) {
                this.positionSuggestionAtCursor(suggestionElement);
            }
        }
    }
    
    getCursorPixelPosition() {
        const cursorPos = this.textarea.selectionStart;
        const text = this.textarea.value;
        
        // Create a temporary span to measure text dimensions
        const tempSpan = document.createElement('span');
        const textareaStyle = window.getComputedStyle(this.textarea);
        
        // Apply all textarea styles to the span
        tempSpan.style.font = textareaStyle.font;
        tempSpan.style.fontFamily = textareaStyle.fontFamily;
        tempSpan.style.fontSize = textareaStyle.fontSize;
        tempSpan.style.fontWeight = textareaStyle.fontWeight;
        tempSpan.style.letterSpacing = textareaStyle.letterSpacing;
        tempSpan.style.padding = '0';
        tempSpan.style.margin = '0';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.visibility = 'hidden';
        
        // Get text before cursor
        const textBeforeCursor = text.substring(0, cursorPos);
        
        // Handle line breaks by splitting and measuring only the last line
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        // Set the span text to the current line content
        tempSpan.textContent = currentLine;
        document.body.appendChild(tempSpan);
        
        // Get the width of text before cursor on current line
        const textWidth = tempSpan.offsetWidth;
        
        // Clean up
        document.body.removeChild(tempSpan);
        
        // Get textarea metrics
        const textareaRect = this.textarea.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(this.textarea);
        
        // Calculate padding and border
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        
        // Calculate line height
        const lineHeight = parseFloat(computedStyle.lineHeight) || 
                          parseFloat(computedStyle.fontSize) * 1.2;
        
        // Calculate cursor position
        const x = paddingLeft + borderLeft + textWidth + 1;
        const y = (lines.length - 1) * lineHeight + paddingTop + borderTop;
        
        return { x, y };
    }
    
    positionSuggestionAtCursor(suggestionElement) {
        const cursorPos = this.getCursorPixelPosition();
        
        // Get textarea scroll position
        const scrollTop = this.textarea.scrollTop;
        const scrollLeft = this.textarea.scrollLeft;
        
        // Position the suggestion at cursor with a small offset to be on the right
        let left = cursorPos.x - scrollLeft;
        let top = cursorPos.y - scrollTop;
        
        // Ensure we're within the textarea bounds
        const textareaWidth = this.textarea.clientWidth;
        const textareaHeight = this.textarea.clientHeight;
        
        // Get suggestion width
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.whiteSpace = 'nowrap';
        tempDiv.style.visibility = 'hidden';
        tempDiv.innerHTML = suggestionElement.innerHTML;
        document.body.appendChild(tempDiv);
        const suggestionWidth = tempDiv.offsetWidth;
        document.body.removeChild(tempDiv);
        
        // Make sure suggestion doesn't overflow horizontally
        if (left + suggestionWidth > textareaWidth) {
            left = textareaWidth - suggestionWidth - 5;
        }
        
        // Make sure suggestion doesn't overflow vertically
        if (top + 20 > textareaHeight) {
            top = textareaHeight - 20;
        }
        
        // Ensure positive positions
        left = Math.max(0, left);
        top = Math.max(0, top);
        
        // Apply positions
        suggestionElement.style.left = left + 'px';
        suggestionElement.style.top = top + 'px';
    }
    
    updateSuggestionList() {
        this.suggestionList.innerHTML = '';
        this.currentSuggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = `suggestion-item ${index === this.selectedSuggestionIndex ? 'active' : ''}`;
            item.innerHTML = `
                <span class="word-text">${suggestion.word}</span>
                <span class="probability">${(suggestion.probability * 100).toFixed(1)}%</span>
            `;
            item.addEventListener('click', () => this.acceptSuggestion(index));
            this.suggestionList.appendChild(item);
        });
    }
    
    showDropdown() {
        if (this.currentSuggestions.length === 0) return;
        
        // Update list first
        this.updateSuggestionList();
        
        // Position dropdown near the suggestion
        const suggestionSpan = this.suggestionOverlay.querySelector('.suggestion-text');
        if (!suggestionSpan) return;
        
        const textareaRect = this.textarea.getBoundingClientRect();
        const suggestionRect = suggestionSpan.getBoundingClientRect();
        const wrapperRect = this.inputWrapper.getBoundingClientRect();
        
        this.suggestionDropdown.style.display = 'block';
        this.suggestionDropdown.style.position = 'fixed';
        
        // Position dropdown to the right of the suggestion
        let left = suggestionRect.right;
        let top = suggestionRect.top;
        
        // Make sure dropdown stays within viewport
        const dropdownWidth = 300;
        const dropdownHeight = Math.min(this.suggestionList.scrollHeight, 300);
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust if dropdown would go off right side of screen
        if (left + dropdownWidth > viewportWidth) {
            left = suggestionRect.left - dropdownWidth - 5;
        }
        
        // Adjust if dropdown would go off bottom of screen
        if (top + dropdownHeight > viewportHeight) {
            top = suggestionRect.bottom - dropdownHeight;
        }
        
        this.suggestionDropdown.style.left = left + 'px';
        this.suggestionDropdown.style.top = top + 'px';
        this.suggestionDropdown.style.zIndex = '1001';
    }
    
    hideDropdown() {
        this.suggestionDropdown.style.display = 'none';
        this.selectedSuggestionIndex = 0;
    }
    
    acceptSuggestion(index) {
        if (index >= this.currentSuggestions.length || !this.isSuggestionVisible) return;
        
        const suggestion = this.currentSuggestions[index];
        const cursorPosition = this.textarea.selectionStart;
        const text = this.textarea.value;
        
        // Get text up to the cursor (which includes the space)
        const textUpToCursor = text.substring(0, cursorPosition);
        
        // Insert suggestion at cursor position (after the space)
        let insertionText = suggestion.word;
        if (this.smartSpaceEnabled) {
            insertionText += ' ';
        }
        
        const newText = textUpToCursor + insertionText;
        this.textarea.value = newText;
        
        // Move cursor to end of inserted text
        const newCursorPos = cursorPosition + insertionText.length;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Clear suggestions
        this.currentSuggestions = [];
        this.currentSuggestionWord = '';
        this.hideSuggestion();
        this.hideDropdown();
        
        // Update stats and preview
        this.updateStats();
        this.updatePreview();
        
        // Trigger input event
        this.textarea.dispatchEvent(new Event('input'));
    }
    
    handleInput() {
        // Update stats and preview
        this.updateStats();
        this.updatePreview();
        
        if (!this.autoSuggestEnabled) return;
        
        // Clear any pending timeout
        if (this.requestTimeout) {
            clearTimeout(this.requestTimeout);
        }
        
        // Check if we're at the correct position for suggestions
        if (this.isCursorAtCorrectPosition()) {
            // Fetch new suggestions
            const text = this.textarea.value.trim();
            
            // Debounce API calls
            this.requestTimeout = setTimeout(() => {
                this.fetchSuggestions(text);
            }, this.suggestionDelay);
        } else {
            this.currentSuggestions = [];
            this.currentSuggestionWord = '';
            this.hideSuggestion();
        }
    }
    
    handleKeyDown(e) {
        if (!this.autoSuggestEnabled) return;
        
        // Handle space key - check if we should trigger suggestions
        if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Allow space to be inserted first
            setTimeout(() => {
                if (this.isCursorAtCorrectPosition()) {
                    const text = this.textarea.value.trim();
                    this.fetchSuggestions(text);
                }
            }, 10);
            return;
        }
        
        // Tab key to accept suggestion
        if (e.key === 'Tab' && this.isSuggestionVisible && this.currentSuggestions.length > 0) {
            e.preventDefault();
            this.acceptSuggestion(0);
            return;
        }
        
        // Arrow down to show dropdown or navigate
        if (e.key === 'ArrowDown' && this.isSuggestionVisible && this.currentSuggestions.length > 0) {
            e.preventDefault();
            if (this.suggestionDropdown.style.display === 'block') {
                // Navigate dropdown
                this.selectedSuggestionIndex = 
                    (this.selectedSuggestionIndex + 1) % this.currentSuggestions.length;
                this.updateSuggestionList();
            } else {
                // Show dropdown
                this.showDropdown();
                this.selectedSuggestionIndex = 0;
                this.updateSuggestionList();
            }
            return;
        }
        
        // Arrow up to navigate dropdown
        if (e.key === 'ArrowUp' && this.suggestionDropdown.style.display === 'block') {
            e.preventDefault();
            this.selectedSuggestionIndex = 
                (this.selectedSuggestionIndex - 1 + this.currentSuggestions.length) % this.currentSuggestions.length;
            this.updateSuggestionList();
            return;
        }
        
        // Right arrow or Enter to accept selected suggestion from dropdown
        if ((e.key === 'Enter' || e.key === 'ArrowRight') && 
            this.suggestionDropdown.style.display === 'block') {
            e.preventDefault();
            this.acceptSuggestion(this.selectedSuggestionIndex);
            return;
        }
        
        // Escape to hide dropdown
        if (e.key === 'Escape') {
            if (this.suggestionDropdown.style.display === 'block') {
                e.preventDefault();
                this.hideDropdown();
            }
            return;
        }
    }
    
    handleClick() {
        // Check cursor position on click
        setTimeout(() => {
            if (this.isCursorAtCorrectPosition() && this.currentSuggestions.length > 0) {
                this.showSuggestion();
            } else {
                this.hideSuggestion();
                this.hideDropdown();
            }
        }, 10);
    }
    
    hideSuggestion() {
        this.suggestionOverlay.innerHTML = '';
        this.isSuggestionVisible = false;
        this.hideDropdown();
    }
    
    updateStats() {
        const text = this.textarea.value;
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        
        this.wordCount.textContent = words.length;
        this.charCount.textContent = text.length;
    }
    
    updatePreview() {
        this.textPreview.textContent = this.textarea.value || 'Your text will appear here...';
    }
}

// Initialize the IME when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.vietnameseIME = new VietnameseIME();
});
