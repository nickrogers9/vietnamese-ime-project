import requests
import json

# Test data
data = {
    "text": "Chiếc lá cuối cùng"
}

# Send request to your Flask app
response = requests.post('http://localhost:5000/predict', 
                        json=data,
                        headers={'Content-Type': 'application/json'})

# Print results
print(json.dumps(response.json(), indent=2, ensure_ascii=False))
