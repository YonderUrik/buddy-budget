
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from dateutil.relativedelta import relativedelta
import calendar


def explode_categories(categories, parent_category_name='', parent_category_id=None):
    exploded_categories = []

    for category in categories:
        category_name = parent_category_name + ' - ' + \
            category['subcategory_name'] if parent_category_name else category['category_name']

        if parent_category_id is not None:
            exploded_categories.append({'subcategory_id': category.get(
                'subcategory_id'), 'subcategory_name': category_name})

        if 'subcategories' in category:
            subcategory_id = category.get('subcategory_id', None)
            exploded_categories.extend(explode_categories(
                category['subcategories'], category_name, subcategory_id))

    return exploded_categories


logger = logging.getLogger(__name__)


class BankingMongo(BaseMongo):
    """
    Mongo driver for banking queries
    """

    def __init__(self):
        """
        Init BankingMongo -> Extend BaseMongo 
        """
        super(BankingMongo, self).__init__()

    def get_expenses_category_chart(self, user_id=None, month=None, year=None):
        try:
            if month == -1:
                startDate = datetime(year, 1, 1)
                endDate = datetime(year, 12, 31)
            else:
                last_day = calendar.monthrange(year, month)[1]
                startDate = datetime(year, month, 1)
                endDate = datetime(year, month, last_day)

            # Define the aggregation pipeline
            # Define the aggregation pipeline
            pipeline = [
                {
                    "$match": {
                        "type": "out",
                        "date": {
                            "$gte": startDate,
                            "$lte": endDate
                        }
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "categoryId": "$categoryId",
                            "subCategoryId": "$subCategoryId"
                        },
                        "totalAmount": {
                            "$sum": "$amount"
                        }
                    }
                },
                {
                    "$group": {
                        "_id": "$_id.categoryId",
                        "data": {
                            "$push": {
                                "x": "$_id.subCategoryId",
                                "y": "$totalAmount"
                            }
                        },
                        "mainTotalAmount": {
                            "$sum": "$totalAmount"
                        }
                    }
                },
                {
                    "$project": {
                        "name": "$_id",
                        "data": 1,
                        "mainTotalAmount": 1,
                        "_id": 0
                    }
                },
                {
                    "$sort": {
                        "mainTotalAmount": -1
                    }
                }
            ]

            # Execute the aggregation query
            result = list(
                self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].aggregate(pipeline))

            status, categories = self.get_categories(user_id=user_id)
            categories = categories['out']

            for document in result:
                categoryId = document['name']

                for category in categories:
                    if category['category_id'] == categoryId:
                        document['name'] = category['category_name']

                        for doc_subCat in document['data']:
                            subCategoryId = doc_subCat['x']
                            for subcategories in category['subcategories']:
                                if subcategories['subcategory_id'] == subCategoryId:
                                    doc_subCat['x'] = subcategories['subcategory_name']
                                    break
                        break

            return 200, result

        except Exception as e:
            logger.error(e)
            return 500, str(e)

    def get_bank_by_name(self, user_id=None, card_name=None):

        try:
            if not card_name or not user_id:
                raise Exception("missing card_name or user_id")

            return True, self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one({"cardName": card_name}, sort=[("lastUpdate", -1)])
        except Exception as e:
            logger.error(e)
            return False, MSG.SOMETHING_GOES_WRONG_ENG

    def insert_new_bank(self, user_id=None, bank_doc=None):

        try:
            if not bank_doc or not user_id:
                raise Exception("missing bank_doc or user_id")

            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                bank_doc)
            return 200, "bank added"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_all_banks(self, user_id):
        try:

            collection = self.client[user_id][MONGO_VARS.BANKS_COLLECTION]

            # Pipeline for aggregation
            pipeline = [
                {
                    '$sort': {
                        'cardName': 1,  # Sort by cardName ascending
                        'lastUpdate': -1  # Then sort by lastUpdate descending
                    }
                },
                {
                    '$group': {
                        '_id': '$cardName',
                        'lastDocument': {'$first': '$$ROOT'}
                    }
                },
                {
                    '$project': {
                        '_id': 1,
                        'cardName': '$lastDocument.cardName',
                        'balance': '$lastDocument.balance',
                        'lastUpdate': '$lastDocument.lastUpdate'
                    }
                }
            ]

            # Use aggregation to get the last document per cardName and place it in the cardName field
            result = list(collection.aggregate(pipeline))

            # Retrieve the "Total" data (sum of all balance and maximum lastUpdate)
            pipeline = [
                {
                    '$sort': {
                        'cardName': 1,    # Sort by cardName ascending
                        'lastUpdate': -1  # Then sort by lastUpdate descending
                    }
                },
                {
                    '$group': {
                        '_id': '$cardName',
                        'lastDocument': {'$first': '$$ROOT'}
                    }
                },
                {
                    '$project': {
                        '_id': 1,
                        'cardName': '$lastDocument.cardName',
                        'balance': '$lastDocument.balance',
                        'lastUpdate': '$lastDocument.lastUpdate'
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'currentBalanceSum': {'$sum': '$balance'},
                        'lastUpdateMax': {'$max': '$lastUpdate'}
                    }
                },
                {
                    '$project': {
                        '_id': 0,
                        'cardName': 'Total',
                        'balance': '$currentBalanceSum',
                        'lastUpdate': '$lastUpdateMax'
                    }
                }
            ]

            # Use aggregation to compute "Total" data
            total_result = list(collection.aggregate(pipeline))

            # Combine the "Total" document with the last documents per cardName
            combined_result = total_result + result

            return 200, combined_result
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def delete_bank(self, user_id=None, cardName=None):
        if not cardName or not user_id:
            return 400, "Missing cardName or user_id"

        try:
            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].delete_many(
                {"cardName": cardName})
            self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].delete_many(
                {"cardName": cardName})
            return 200, "Bank deleted"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def edit_bank(self, user_id=None, oldBank=None, newValues=None):
        try:
            if oldBank != newValues['cardName']:
                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_many(
                    {"cardName": oldBank}, {"$set": {"cardName": newValues['cardName']}})
                self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].update_many(
                    {"cardName": oldBank}, {"$set": {"cardName": newValues['cardName']}})
            else:
                last_value_of_bank = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                    {"cardName": oldBank}, sort=[("lastUpdate", -1)])

                if last_value_of_bank['balance'] == newValues['balance']:
                    return 400, "Nothing change"

            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                newValues)
            return 200, "Edited"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_categories(self, user_id=None):
        try:
            return 200, self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one({"type": "budgetting-categories"})
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def is_category_in_list(self, user_id=None, categoryId=None, operationType=None):
        try:
            result = self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one(
                {"type": "budgetting-categories"})

            if result and operationType in result:
                return categoryId in (cat["category_id"] for cat in result[operationType])

        except Exception as e:
            logger.error(e)

        return False

    def is_subcategory_in_list(self, user_id=None, categoryId=None, subCategoryId=None, operationType=None):
        try:
            result = self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one(
                {"type": "budgetting-categories"})

            if result and operationType in result:
                for category in result[operationType]:
                    if category['category_id'] == categoryId:
                        subcategories = category.get('subcategories', [])
                        subcategory_ids = [subcat['subcategory_id']
                                           for subcat in subcategories]
                        return subCategoryId in subcategory_ids

        except Exception as e:
            logger.error(e)
        return False

    def add_transaction(self, user_id=None, transaction_doc=None):
        # TODO: Optimize this function. A lot of parts are repeated
        try:
            if not user_id or not transaction_doc:
                raise Exception("missing values")

            if transaction_doc['type'] == 'transfer':
                is_transfer = True
            else:
                is_transfer = False

            # Insert transaction
            result = self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].insert_one(
                transaction_doc)

            if not is_transfer:
                # Now get the last bankBalance before the transaction date
                last_bank_update = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                    {"cardName": transaction_doc['cardName'], "lastUpdate": {"$lt": transaction_doc['date']}}, sort=[("_id", -1)])

                # If there are historical data before the transaction date
                if last_bank_update:
                    # Get all bank documents where the lastUpdate is greater to the transaction date,
                    # then update all their balance with the new transaction amount
                    new_bank_doc = {
                        "cardName": transaction_doc['cardName'],
                        "lastUpdate": transaction_doc['date']
                    }
                    new_bank_doc['transactionID'] = str(result.inserted_id)

                    # If there are historical data after the transaction date
                    bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                        {"cardName": new_bank_doc['cardName'], "lastUpdate": {"$gt": new_bank_doc['lastUpdate']}}))
                    if bank_documents_to_edit:
                        for elem in bank_documents_to_edit:
                            if transaction_doc['type'] == 'in':
                                new_amount = elem['balance'] + \
                                    transaction_doc['amount']
                            else:
                                new_amount = elem['balance'] - \
                                    transaction_doc['amount']

                            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                    last_balance = last_bank_update['balance']

                    if transaction_doc['type'] == 'in':
                        new_balance = last_balance + transaction_doc['amount']
                    else:
                        new_balance = last_balance - transaction_doc['amount']

                    new_bank_doc['balance'] = new_balance

                    self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                        new_bank_doc)
            else:
                if transaction_doc['cardName'] == 'External wallet':

                    # In this case the transaction is like an income

                    last_bank_update = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                        {"cardName": transaction_doc['cardNameTo'], "lastUpdate": {"$lt": transaction_doc['date']}}, sort=[("_id", -1)])

                    if last_bank_update:
                        new_bank_doc = {
                            "cardName": transaction_doc['cardNameTo'],
                            "lastUpdate": transaction_doc['date']
                        }
                        new_bank_doc['transactionID'] = str(result.inserted_id)
                        # If there are historical data after the transaction date
                        bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                            {"cardName": new_bank_doc['cardName'], "lastUpdate": {"$gt": new_bank_doc['lastUpdate']}}))
                        if bank_documents_to_edit:
                            for elem in bank_documents_to_edit:
                                new_amount = elem['balance'] + \
                                    transaction_doc['amount']
                                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                    {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                        last_balance = last_bank_update['balance']
                        new_balance = last_balance + transaction_doc['amount']
                        new_bank_doc['balance'] = new_balance
                        self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                            new_bank_doc)
                elif transaction_doc['cardNameTo'] == 'External wallet':
                    # In this case the transaction is like an expense
                    last_bank_update = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                        {"cardName": transaction_doc['cardName'], "lastUpdate": {"$lt": transaction_doc['date']}}, sort=[("_id", -1)])

                    if last_bank_update:
                        new_bank_doc = {
                            "cardName": transaction_doc['cardName'],
                            "lastUpdate": transaction_doc['date']
                        }
                        new_bank_doc['transactionID'] = str(result.inserted_id)

                        # If there are historical data after the transaction date
                        bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                            {"cardName": new_bank_doc['cardName'], "lastUpdate": {"$gt": new_bank_doc['lastUpdate']}}))
                        if bank_documents_to_edit:
                            for elem in bank_documents_to_edit:
                                new_amount = elem['balance'] - \
                                    transaction_doc['amount']

                                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                    {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                        last_balance = last_bank_update['balance']

                        new_balance = last_balance - transaction_doc['amount']

                        new_bank_doc['balance'] = new_balance

                        self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                            new_bank_doc)

                else:
                    # In this case the transaction is like an transfer from a bank accoun to another
                    last_bank_update_from = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                        {"cardName": transaction_doc['cardName'], "lastUpdate": {"$lt": transaction_doc['date']}}, sort=[("_id", -1)])
                    last_bank_update_to = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one(
                        {"cardName": transaction_doc['cardNameTo'], "lastUpdate": {"$lt": transaction_doc['date']}}, sort=[("_id", -1)])

                    if last_bank_update_from:
                        new_bank_doc = {
                            "cardName": transaction_doc['cardName'],
                            "lastUpdate": transaction_doc['date']
                        }
                        new_bank_doc['transactionID'] = str(result.inserted_id)

                        # If there are historical data after the transaction date
                        bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                            {"cardName": new_bank_doc['cardName'], "lastUpdate": {"$gt": new_bank_doc['lastUpdate']}}))
                        if bank_documents_to_edit:
                            for elem in bank_documents_to_edit:
                                new_amount = elem['balance'] - \
                                    transaction_doc['amount']

                                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                    {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                        last_balance = last_bank_update_from['balance']

                        new_balance = last_balance - transaction_doc['amount']

                        new_bank_doc['balance'] = new_balance

                        self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                            new_bank_doc)

                    if last_bank_update_to:
                        new_bank_doc = {
                            "cardName": transaction_doc['cardNameTo'],
                            "lastUpdate": transaction_doc['date']
                        }
                        new_bank_doc['transactionID'] = str(result.inserted_id)

                        # If there are historical data after the transaction date
                        bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                            {"cardName": new_bank_doc['cardName'], "lastUpdate": {"$gt": new_bank_doc['lastUpdate']}}))
                        if bank_documents_to_edit:
                            for elem in bank_documents_to_edit:
                                new_amount = elem['balance'] + \
                                    transaction_doc['amount']

                                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                    {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                        last_balance = last_bank_update_to['balance']

                        new_balance = last_balance + transaction_doc['amount']

                        new_bank_doc['balance'] = new_balance

                        self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(
                            new_bank_doc)
            return 200, "Transaction added"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_transactions(self, user_id=None, startDate=None, endDate=None):
        try:
            if not user_id:
                raise Exception("missing values")

            result = list(self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].find(
                {"date": {"$gte": startDate, "$lte": endDate}}).sort("date", -1))
            return 200, result
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_summary_net_worth(self, user_id=None):
        try:
            # Create an aggregation pipeline to group data by CardName and date
            pipeline = [
                {
                    "$sort": {
                        "cardName": 1,
                        "lastUpdate": 1
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "cardName": "$cardName",
                            "date": {
                                "$dateToString": {
                                    "format": "%Y-%m-%d",
                                    "date": "$lastUpdate"
                                }
                            }
                        },
                        "balance": {"$last": "$balance"}
                    }
                },
                {
                    "$project": {
                        "name": "$_id.cardName",
                        "date": "$_id.date",
                        "balance": 1,
                        "lastUpdate": 1
                    }
                },
                {
                    "$group": {
                        "_id": "$name",
                        "data": {
                            "$push": {
                                "x": "$date",
                                "y": "$balance",
                            }
                        }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "name": "$_id",
                        "data": {
                            "$map": {
                                "input": "$data",
                                "as": "datum",
                                "in": {
                                    "x": "$$datum.x",
                                    "y": {
                                        "$ifNull": ["$$datum.y", {"$first": "$$datum.y"}]
                                    },
                                }
                            }
                        }
                    }
                }
            ]
            result = list(
                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].aggregate(pipeline))

           # Assuming you have the result in the 'result' variable
            # Find the maximum date across all elements
            max_date = max(max(item['data'], key=lambda x: x['x'])[
                           'x'] for item in result)
            max_date_datetime = datetime.strptime(max(max(item['data'], key=lambda x: x['x'])[
                                                  'x'] for item in result), '%Y-%m-%d').replace(hour=23, minute=59, second=59)

            for item in result:

                data = sorted(item['data'], key=lambda item: item['x'])
                if len(data) > 0:
                    filled_data = []
                    current_date = datetime.strptime(
                        min(data[0]['x'], max_date), '%Y-%m-%d')
                    for point in data:
                        while current_date < datetime.strptime(point['x'], '%Y-%m-%d'):
                            # Fill missing dates with the value of the previous date
                            filled_data.append({'x': current_date.strftime(
                                '%Y-%m-%d'), 'y': filled_data[-1]['y']})
                            current_date += timedelta(days=1)
                        filled_data.append({'x': point['x'], 'y': point['y']})
                        current_date += timedelta(days=1)
                    # Fill any remaining dates up to the max_date
                    while current_date <= max_date_datetime:
                        filled_data.append({'x': current_date.strftime(
                            '%Y-%m-%d'), 'y': filled_data[-1]['y']})
                        current_date += timedelta(days=1)
                    item['data'] = filled_data

            # Create a dictionary to store the sums for each 'x' value
            totals = {}

            for item in result:
                for entry in item['data']:
                    x_value = entry['x']
                    y_value = entry['y']
                    if x_value in totals:
                        totals[x_value] += y_value
                    else:
                        totals[x_value] = y_value

            # Create the 'Total' document with the aggregated values
            total_document = {'name': 'Total', 'data': [
                {'x': x, 'y': total} for x, total in totals.items()]}

            # Sort the data by 'x' date
            sorted_data = sorted(total_document['data'], key=lambda x: x['x'])

            # Round 'y' values to two decimals
            for item in sorted_data:
                item['y'] = round(item['y'], 2)

            # Updated sorted data
            sorted_data_with_rounded_y = {
                'name': total_document['name'],
                'data': sorted_data
            }

            return 200, [sorted_data_with_rounded_y]

        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_summary_of_month_for_chart(self, user_id=None, startDate=None, endDate=None):
        try:
            if not user_id:
                raise Exception("Missing user_id")

            # Get the current date and time
            current_date = datetime.now()
            # Initialize the data structure
            data = {
                "labels": [],
                "series": [
                    {"name": "Income", "type": "area",
                        "fill": "gradient", "data": []},
                    {"name": "Expense", "type": "area",
                        "fill": "gradient", "data": []},
                ],
            }

            # Loop through each day of the current month and retrieve transactions
            current_day = startDate
            while current_day <= endDate:
                # Calculate the start and end time for the current day
                start_of_day = current_day
                end_of_day = start_of_day + relativedelta(days=1, seconds=-1)

                # Retrieve transactions for the current day
                transactions = list(
                    self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].find(
                        {
                            "date": {"$gte": start_of_day, "$lte": end_of_day}
                        }
                    )
                )

                # Calculate the total income and total expense for the day
                total_income = sum(
                    transaction["amount"] for transaction in transactions if transaction["type"] == "in")
                total_expense = sum(
                    transaction["amount"] for transaction in transactions if transaction["type"] == "out")

                # Add the label and data to the data structure
                data["labels"].append(end_of_day.strftime("%m/%d/%Y"))
                data["series"][0]["data"].append(total_income)
                data["series"][1]["data"].append(total_expense)

                # Move to the next day
                current_day += relativedelta(days=1)

            return 200, data
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_single_transaction(self, user_id=None, transaction_id=None):
        try:
            if not user_id or not transaction_id:
                raise Exception("missing values")

            return 200, self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].find_one({"_id": ObjectId(transaction_id)})
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def delete_transaction(self, user_id=None, transaction_id=None):
        try:
            if not user_id or not transaction_id:
                raise Exception("missing values")

            status, transaction_doc = self.get_single_transaction(
                user_id=user_id, transaction_id=transaction_id)

            if status != 200:
                raise Exception("Error on get_single_transaction")

            bank_documents_start = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                {"transactionID": transaction_id}))

            if bank_documents_start:
                for document in bank_documents_start:

                    first_last_update = document['lastUpdate']
                    cardName = document['cardName']

                    bank_documents_to_edit = list(self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find(
                        {"cardName": cardName, "lastUpdate": {"$gt": first_last_update}}))

                    if bank_documents_to_edit:
                        for elem in bank_documents_to_edit:
                            if transaction_doc['type'] == 'in':
                                new_amount = elem['balance'] + \
                                    transaction_doc['amount']
                            elif transaction_doc['type'] == 'out':
                                new_amount = elem['balance'] - \
                                    transaction_doc['amount']
                            elif transaction_doc['type'] == 'transfer':
                                if transaction_doc['cardName'] == cardName:
                                    # This is the bank from, so i need to add amount to this account
                                    new_amount = elem['balance'] + \
                                        transaction_doc['amount']
                                elif transaction_doc['cardNameTo'] == cardName:
                                    # This is the bank to
                                    new_amount = elem['balance'] - \
                                        transaction_doc['amount']

                            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_one(
                                {"_id": ObjectId(elem['_id'])}, {"$set": {"balance": new_amount}})

                    self.client[user_id][MONGO_VARS.BANKS_COLLECTION].delete_one(
                        {"transactionID": transaction_id})

            self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].delete_many(
                {"_id": ObjectId(transaction_id)})

            return 200, "Transaction deleted"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_distinct_user_data_year(self, user_id=None):
        try:
            if not user_id:
                raise Exception("missing user_id")

            collection = self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION]

            # Aggregation pipeline to get distinct ISO dates by year
            pipeline = [
                {
                    "$group": {
                        "_id": {
                            "year": {"$year": "$date"}
                        }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "year": "$_id.year"
                    }
                },
                {
                    "$sort": {"year": 1}
                }
            ]

            distinct_years = [doc['year']
                              for doc in list(collection.aggregate(pipeline))]

            if datetime.now().year not in distinct_years:
                distinct_years.append(datetime.now().year)

            return 200, distinct_years
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    def get_saving_rates(self, user_id=None):
        try:
            collection = self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION]
            pipeline = [
                {"$group": {"_id": "$type", "totalAmount": {"$sum": "$amount"}}},
                {"$project": {"_id": 0, "type": "$_id", "totalAmount": 1}},
                {
                    "$group": {
                        "_id": None,
                        "totalIncome": {
                            "$sum": {"$cond": {"if": {"$eq": ["$type", "in"]}, "then": "$totalAmount", "else": 0}}
                        },
                        "totalExpense": {
                            "$sum": {"$cond": {"if": {"$eq": ["$type", "out"]}, "then": "$totalAmount", "else": 0}}
                        },
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "totalIncome": 1,
                        "totalExpense": 1,
                        "savingRate": {
                            "$divide": [
                                {"$subtract": [
                                    "$totalIncome", "$totalExpense"]},
                                # To avoid division by zero
                                {"$max": [
                                    "$totalIncome", 1]}
                            ]
                        }
                    }
                }
            ]
            saving_rate_result = list(collection.aggregate(pipeline))
            return 200, saving_rate_result
        except Exception as e:
            return 500, str(e)

    def get_mean_of_expenses(self, user_id=None):
        try:
            collection = self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION]

            # Aggregation pipeline
            # "date": {"$gte": datetime(target_year, 1, 1), "$lt": datetime(target_year + 1, 1, 1)}
            pipeline = [
                {"$match": {"type": "out"}},
                {"$group": {
                    "_id": {"$month": "$date"},
                    "totalAmount": {"$sum": "$amount"}
                }},
                {"$project": {
                    "_id": 0,
                    "month": "$_id",
                    "totalAmount": 1
                }},
                {"$group": {
                    "_id": None,
                    "totalExpenses": {"$sum": "$totalAmount"},
                    "numMonths": {"$sum": 1}
                }},
                {"$project": {
                    "_id": 0,
                    "meanExpensesPerMonth": {"$divide": ["$totalExpenses", "$numMonths"]}
                }}
            ]

            # Execute aggregation pipeline

            result = list(collection.aggregate(pipeline))

            # Calculate mean of expenses
            mean_expenses = result[0]["meanExpensesPerMonth"] if result else 0

            return 200, mean_expenses
        except Exception as e:
            return 500, str(e)
