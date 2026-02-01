from flask import Flask, request, jsonify
from transformers import GPT2Tokenizer, GPT2LMHeadModel
import torch.nn.functional as F
import torch
from flask_cors import CORS
import re
import unicodedata

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load model and tokenizer (done once when the app starts)
print("Loading model...")
try:
    tokenizer = GPT2Tokenizer.from_pretrained('NlpHUST/gpt2-vietnamese')
    
    # Add padding token if it doesn't exist
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = GPT2LMHeadModel.from_pretrained('NlpHUST/gpt2-vietnamese')
    
    # Set model to evaluation mode
    model.eval()
    
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    tokenizer = None
    model = None

def remove_diacritics(text):
    """Remove Vietnamese diacritics to check for bare letters"""
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )

def is_valid_vietnamese_word(word):
    """Strict check if the word is a valid Vietnamese word"""
    if not word or len(word.strip()) == 0:
        return False
    
    word = word.strip()
    
    # Check minimum length
    if len(word) < 2:
        return False
    
    # Check if it contains at least one Vietnamese letter
    vietnamese_letters = re.compile(
        r'[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ]'
    )
    
    # Check if it's a common short word
    common_short_words = {
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 
        'of', 'for', 'with', 'by', 'as', 'is', 'am', 'are', 'was', 'were',
        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
        'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might',
        'must', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
        'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
        'mine', 'yours', 'hers', 'ours', 'theirs',
        # Vietnamese common words
        'tôi', 'bạn', 'anh', 'chị', 'em', 'nó', 'họ', 'ta', 'mình',
        'có', 'không', 'và', 'nhưng', 'hoặc', 'nếu', 'thì', 'mà', 'là',
        'đã', 'đang', 'sẽ', 'vừa', 'mới', 'cũng', 'rất', 'quá', 'lắm'
    }
    
    # Remove diacritics for checking common words
    word_lower = word.lower()
    word_no_diacritics = remove_diacritics(word_lower)
    
    # Check if it's a common short word (with or without diacritics)
    if word_lower in common_short_words or word_no_diacritics in common_short_words:
        return True
    
    # For longer words, require Vietnamese letters or be in dictionary
    if len(word) >= 3:
        # Must contain Vietnamese letters
        if not vietnamese_letters.search(word):
            # Check if it looks like gibberish (repeating patterns, random letters)
            # Count ratio of consonants to vowels
            vowels = 'aeiouyàáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ'
            consonants = 'bcdfghjklmnpqrstvwxz'
            
            vowel_count = sum(1 for c in word_lower if c in vowels)
            consonant_count = sum(1 for c in word_lower if c in consonants)
            total_letters = vowel_count + consonant_count
            
            if total_letters == 0:
                return False
            
            # Gibberish often has unusual consonant-vowel patterns
            # Check for repeating patterns like "asdf", "qwerty"
            common_gibberish_patterns = [
                r'(.)\1{2,}',  # Same character repeated 3+ times
                r'^[qwertyuiop]+$',  # Just keyboard rows
                r'^[asdfghjkl]+$',
                r'^[zxcvbnm]+$',
                r'^[bcdfghjklmnpqrstvwxyz]{4,}$',  # All consonants
                r'^[aeiouy]{4,}$',  # All vowels
            ]
            
            for pattern in common_gibberish_patterns:
                if re.search(pattern, word_lower):
                    return False
            
            # If no Vietnamese letters and not clearly gibberish, allow if reasonable
            # But require at least 70% letters
            letter_ratio = total_letters / len(word)
            if letter_ratio < 0.7:
                return False
    
    # Count valid letters (including Vietnamese)
    valid_letters = sum(1 for c in word if c.isalpha() or vietnamese_letters.search(c))
    
    # At least 70% of the word should be valid letters
    if valid_letters / len(word) < 0.7:
        return False
    
    return True

@app.route('/predict', methods=['POST'])
def predict_next_words():
    """
    Endpoint that receives text and returns top 5 next word predictions
    """
    try:
        # Check if model is loaded
        if model is None or tokenizer is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Get JSON data from the request
        data = request.get_json()
        
        # Extract the input text
        if 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
            
        text = data['text'].strip()
        
        # Only make predictions if the text is valid (not gibberish)
        if len(text) == 0:
            return jsonify({'predictions': [], 'message': 'Empty text'})
        
        # Check if the last word is valid
        words = text.split()
        if not words:
            return jsonify({'predictions': [], 'message': 'No words found'})
        
        last_word = words[-1]
        if not is_valid_vietnamese_word(last_word):
            return jsonify({
                'predictions': [],
                'message': 'Last word is not a valid word'
            })
        
        # Also check the overall text isn't gibberish
        # Count valid words vs total words
        valid_word_count = sum(1 for w in words if is_valid_vietnamese_word(w))
        if valid_word_count / len(words) < 0.5 and len(words) > 3:
            return jsonify({
                'predictions': [],
                'message': 'Text appears to be gibberish'
            })
        
        # Tokenize input text
        input_ids = tokenizer.encode(text, return_tensors='pt')
        
        # Get model predictions
        with torch.no_grad():
            outputs = model(input_ids)
            predictions = outputs.logits
        
        # Get predictions for the next token
        next_token_logits = predictions[0, -1, :]
        probabilities = F.softmax(next_token_logits, dim=-1)
        top_prob, top_indices = torch.topk(probabilities, 20)
        
        # Process results
        results = []
        seen_words = set()
        
        for prob, idx in zip(top_prob, top_indices):
            if len(results) >= 5:
                break
                
            word = tokenizer.decode([idx]).strip()
            
            # Clean up the word (GPT2 tokenizer uses special characters)
            word = word.replace('Ġ', ' ')  # GPT2 tokenizer uses Ġ for spaces
            word = word.replace(' ', '')
            
            # Filter out unwanted tokens
            if word.startswith('<') and word.endswith('>'):
                continue
            
            # Ensure it's a valid Vietnamese word
            if (word and 
                len(word) > 0 and 
                not word.isspace() and
                word not in seen_words and
                is_valid_vietnamese_word(word)):
                
                # Clean any special characters
                word = re.sub(r'[^\w\sÀ-ỹ]', '', word)
                
                if word and word not in seen_words:
                    seen_words.add(word)
                    results.append({
                        'word': word,
                        'probability': round(prob.item(), 4)
                    })
        
        # Return JSON response
        return jsonify({
            'predictions': results
        })
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        return jsonify({'predictions': [], 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    if model and tokenizer:
        return jsonify({'status': 'healthy', 'message': 'Service is running with model loaded'})
    else:
        return jsonify({'status': 'error', 'message': 'Model not loaded'}), 500

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
