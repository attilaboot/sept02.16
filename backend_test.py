import requests
import sys
import json
from datetime import datetime

class TurbochargerAPITester:
    def __init__(self, base_url="https://hungarian-chat.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_ids = {
            'part_types': [],
            'suppliers': [],
            'parts': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'id' in response_data:
                        print(f"   Response ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_initialize_data(self):
        """Test data initialization"""
        success, response = self.run_test(
            "Initialize Data",
            "POST",
            "initialize-data",
            200
        )
        return success

    def test_get_part_types(self):
        """Test getting part types"""
        success, response = self.run_test(
            "Get Part Types",
            "GET",
            "part-types",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} part types")
            for pt in response:
                if 'id' in pt:
                    self.created_ids['part_types'].append(pt['id'])
        return success

    def test_get_suppliers(self):
        """Test getting suppliers"""
        success, response = self.run_test(
            "Get Suppliers",
            "GET",
            "suppliers",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} suppliers")
            for s in response:
                if 'id' in s:
                    self.created_ids['suppliers'].append(s['id'])
        return success

    def test_create_part_type(self):
        """Test creating a new part type"""
        test_name = f"Test Type {datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "Create Part Type",
            "POST",
            "part-types",
            200,
            data={"name": test_name}
        )
        if success and 'id' in response:
            self.created_ids['part_types'].append(response['id'])
        return success

    def test_create_supplier(self):
        """Test creating a new supplier"""
        test_name = f"Test Supplier {datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "Create Supplier",
            "POST",
            "suppliers",
            200,
            data={"name": test_name}
        )
        if success and 'id' in response:
            self.created_ids['suppliers'].append(response['id'])
        return success

    def test_create_part(self):
        """Test creating a new part"""
        if not self.created_ids['part_types'] or not self.created_ids['suppliers']:
            print("❌ Cannot create part - missing part types or suppliers")
            return False

        test_code = f"TEST{datetime.now().strftime('%H%M%S')}"
        part_data = {
            "name": "BMW Turbo CHRA Test",
            "code": test_code,
            "part_type_id": self.created_ids['part_types'][0],
            "supplier_id": self.created_ids['suppliers'][0]
        }
        
        success, response = self.run_test(
            "Create Part",
            "POST",
            "parts",
            200,
            data=part_data
        )
        if success and 'id' in response:
            self.created_ids['parts'].append(response['id'])
        return success

    def test_get_parts(self):
        """Test getting parts"""
        success, response = self.run_test(
            "Get Parts",
            "GET",
            "parts",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} parts")
        return success

    def test_search_parts(self):
        """Test searching parts"""
        success, response = self.run_test(
            "Search Parts",
            "GET",
            "parts",
            200,
            params={"search": "BMW"}
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} parts matching 'BMW'")
        return success

    def test_stock_movement_in(self):
        """Test stock IN movement"""
        if not self.created_ids['parts']:
            print("❌ Cannot test stock movement - no parts available")
            return False

        movement_data = {
            "part_id": self.created_ids['parts'][0],
            "movement_type": "IN",
            "quantity": 10
        }
        
        success, response = self.run_test(
            "Stock Movement IN",
            "POST",
            "stock-movements",
            200,
            data=movement_data
        )
        return success

    def test_stock_movement_out(self):
        """Test stock OUT movement"""
        if not self.created_ids['parts']:
            print("❌ Cannot test stock movement - no parts available")
            return False

        movement_data = {
            "part_id": self.created_ids['parts'][0],
            "movement_type": "OUT",
            "quantity": 5
        }
        
        success, response = self.run_test(
            "Stock Movement OUT",
            "POST",
            "stock-movements",
            200,
            data=movement_data
        )
        return success

    def test_stock_movement_insufficient(self):
        """Test stock OUT movement with insufficient stock"""
        if not self.created_ids['parts']:
            print("❌ Cannot test stock movement - no parts available")
            return False

        movement_data = {
            "part_id": self.created_ids['parts'][0],
            "movement_type": "OUT",
            "quantity": 1000  # Should fail due to insufficient stock
        }
        
        success, response = self.run_test(
            "Stock Movement OUT (Insufficient)",
            "POST",
            "stock-movements",
            400,  # Expecting error
            data=movement_data
        )
        return success

    def test_update_part(self):
        """Test updating a part"""
        if not self.created_ids['parts']:
            print("❌ Cannot test part update - no parts available")
            return False

        update_data = {
            "name": "Updated BMW Turbo CHRA"
        }
        
        success, response = self.run_test(
            "Update Part",
            "PUT",
            f"parts/{self.created_ids['parts'][0]}",
            200,
            data=update_data
        )
        return success

    def test_duplicate_code_error(self):
        """Test creating part with duplicate code (should fail)"""
        if not self.created_ids['part_types'] or not self.created_ids['suppliers']:
            print("❌ Cannot test duplicate code - missing part types or suppliers")
            return False

        # Use the same code as the first created part
        if not self.created_ids['parts']:
            print("❌ Cannot test duplicate code - no existing parts")
            return False

        part_data = {
            "name": "Duplicate Code Test",
            "code": f"TEST{datetime.now().strftime('%H%M%S')}",  # This should be unique, let's use existing code
            "part_type_id": self.created_ids['part_types'][0],
            "supplier_id": self.created_ids['suppliers'][0]
        }
        
        # First create a part
        success1, response1 = self.run_test(
            "Create Part for Duplicate Test",
            "POST",
            "parts",
            200,
            data=part_data
        )
        
        if success1:
            # Now try to create another with same code
            success2, response2 = self.run_test(
                "Create Part with Duplicate Code (Should Fail)",
                "POST",
                "parts",
                400,  # Expecting error
                data=part_data
            )
            return success2
        return False

def main():
    print("🚀 Starting Turbocharger Database API Tests")
    print("=" * 50)
    
    tester = TurbochargerAPITester()
    
    # Test sequence
    tests = [
        tester.test_initialize_data,
        tester.test_get_part_types,
        tester.test_get_suppliers,
        tester.test_create_part_type,
        tester.test_create_supplier,
        tester.test_create_part,
        tester.test_get_parts,
        tester.test_search_parts,
        tester.test_stock_movement_in,
        tester.test_stock_movement_out,
        tester.test_stock_movement_insufficient,
        tester.test_update_part,
        tester.test_duplicate_code_error
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())