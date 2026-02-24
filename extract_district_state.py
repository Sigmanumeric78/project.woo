import json

print("📖 Reading pin code data (without geometry)...")

# Read the simplified JSON file
with open('All_India_pincode_NO_GEOMETRY.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract unique data
pin_to_location = {}
districts = set()
states = set()

for feature in data['features']:
    # Extract pin code, division (district), and circle (state)
    pincode = feature.get('Pincode', '').strip()
    division = feature.get('Division', '').strip()  # This will be our District
    circle = feature.get('Circle', '').strip()      # This will be our State
    
    if pincode and division and circle:
        # Store the mapping (use first occurrence for each pin code)
        if pincode not in pin_to_location:
            pin_to_location[pincode] = {
                'district': division,
                'state': circle
            }
        
        # Collect unique districts and states
        districts.add(division)
        states.add(circle)

# Sort for better readability
sorted_pincodes = sorted(pin_to_location.keys())
sorted_districts = sorted(districts)
sorted_states = sorted(states)

print(f"\n✅ Extracted {len(sorted_pincodes)} pin codes")
print(f"✅ Extracted {len(sorted_districts)} unique districts")
print(f"✅ Extracted {len(sorted_states)} unique states")

# Generate JavaScript output
print("\n📝 Generating JavaScript file...")

js_output = f"""// Auto-generated from Indian Pin Code data
// Total Pin Codes: {len(sorted_pincodes)}
// Total Districts: {len(sorted_districts)}
// Total States: {len(sorted_states)}

const indianPinCodeData = {{
    // Pin code to District and State mapping
    pinToLocation: {{
{chr(10).join(f'        "{k}": {json.dumps(v)},' for k, v in sorted(pin_to_location.items()))}
    }},
    
    // All unique districts
    districts: {json.dumps(sorted_districts, indent=8)},
    
    // All unique states (circles)
    states: {json.dumps(sorted_states, indent=8)}
}};

// Get district and state from pin code
function getLocationByPinCode(pinCode) {{
    return indianPinCodeData.pinToLocation[pinCode] || null;
}}

// Validate if pin code exists
function isValidPinCode(pinCode) {{
    return pinCode in indianPinCodeData.pinToLocation;
}}
"""

# Write to file
with open('indian_pincode_data.js', 'w', encoding='utf-8') as f:
    f.write(js_output)

import os
file_size = os.path.getsize('indian_pincode_data.js')
print(f"✅ Generated indian_pincode_data.js ({file_size:,} bytes / {file_size / 1024:.2f} KB)")

# Print sample data
print("\n📋 Sample Data:")
sample_pins = list(pin_to_location.items())[:5]
for pin, loc in sample_pins:
    print(f"   {pin}: District={loc['district']}, State={loc['state']}")

print("\n📋 All States:")
for state in sorted_states:
    print(f"   - {state}")
