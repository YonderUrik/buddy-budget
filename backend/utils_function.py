import re
from datetime import datetime

# Pass every reqeust.json from here
def clean_and_validate_data(data):
    cleaned_data = {}
    errors = {}
    try:
        if type(data) != dict:
            errors['data'] = "invalid data type"
            raise("data")
        
        ######################### 
        # AUTHENTICATION FIELDS #
        #########################

        # Field: "email"
        if 'email' in data:
            email = data['email'].strip()
            # Perform email validation using a simple regular expression
            if re.match(r"[^@]+@[^@]+\.[^@]+", email):
                cleaned_data['email'] = email
            else:
                errors['email'] = 'Invalid email address'
                raise("email")

        # Field: "firstName"
        if 'firstName' in data:
            first_name = data['firstName'].strip()
            # Add validation rules specific to the "firstName" field
            if len(first_name) >= 2:
                cleaned_data['firstName'] = first_name
            else:
                errors['firstName'] = 'First name must be at least 2 characters long'
                raise("firstName")

        # Field: "lastName"
        if 'lastName' in data:
            last_name = data['lastName'].strip()
            # Add validation rules specific to the "lastName" field
            if len(last_name) >= 2:
                cleaned_data['lastName'] = last_name
            else:
                errors['lastName'] = 'Last name must be at least 2 characters long'
                raise("lastName")

        # Field: "password"
        if 'password' in data:
            password = data['password']
            # Add password validation rules (e.g., length, complexity)
            if len(password) >= 8:
                cleaned_data['password'] = password
            else:
                errors['password'] = 'Password must be at least 8 characters long'
                raise("password")
        
        # Field: "code"
        if 'code' in data:
            code = data['code']

            try:
                cleaned_data['code'] = int(code)
            except:
                errors['code'] = 'The code must consist of numbers only'
                raise("code")
        
        ######################### 
        # BANKING SECTION FIELDS #
        #########################

        # Field : "cardName"
        if 'cardName' in data:
            cardName = data['cardName']

            if len(cardName) < 3:
                errors['cardName'] = 'Card name must be at least 3 characters long'
                raise('cardName')
            if cardName == 'Total':
                errors['cardName'] = 'Card name cannot be Total'
                raise('cardName')
            else:
                cleaned_data['cardName'] = cardName

        # Field : "oldBank"
        if 'oldBank' in data:
            oldBank = data['oldBank']

            if len(oldBank) < 3:
                errors['oldBank'] = 'Card name must be at least 3 characters long'
                raise('oldBank')
            if oldBank == 'Total':
                errors['oldBank'] = 'Card name cannot be Total'
                raise('oldBank')
            else:
                cleaned_data['oldBank'] = oldBank

        # Field : "balance"
        if 'balance' in data:
            balance = data['balance']
            try:
                cleaned_data['balance'] = float(balance)
            except:
                errors['balance'] = 'The balance is not a valid data type'
                raise("balance")
        
        # Field  : "type"
        if 'type' in data:
            typeField = data['type']

            if typeField not in ['in', 'out']:
                errors['type'] = 'The type is invaid'
                raise("type")
            
            cleaned_data['type'] = typeField
            
        # Field : "amount"
        if 'amount' in data:
            amount = data['amount']
            try:
                cleaned_data['amount'] = float(amount)
            except:
                errors['amount'] = 'The amount is not a valid data type'
                raise("amount")
            
        # Field : "categoryId"
        if 'categoryId' in data:
            categoryId = data['categoryId']
            try:
                cleaned_data['categoryId'] = int(categoryId)
            except:
                errors['categoryId'] = 'The categoryId is not a valid data type'
                raise("categoryId")
            
        # Field : "subCategoryId"
        if 'subCategoryId' in data:
            subCategoryId = data['subCategoryId']
            try:
                cleaned_data['subCategoryId'] = int(subCategoryId)
            except:
                errors['subCategoryId'] = 'The subCategoryId is not a valid data type'
                raise("subCategoryId")
            
        # Field : "date"
        if 'date' in data:
            date = data['date']
            try:
                # Define the format of the input string
                date_format = "%Y-%m-%dT%H:%M:%S.%fZ"

                # Convert the string to a datetime object
                cleaned_data['date'] = datetime.strptime(date, date_format)
            except:
                errors['date'] = 'The date is not a valid data type'
                raise("date")
            

        if not cleaned_data:
            errors['nodata'] = "no correct data provided"
            raise('nodata')
            
        return cleaned_data, None  # If everything is valid, return the cleaned data and no errors
    except Exception as e:
        print(str(e))
        return None, errors[str(e)]  # If there are errors, return None and the error dictionary
            
