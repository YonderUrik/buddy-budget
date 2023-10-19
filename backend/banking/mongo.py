
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging
from datetime import datetime

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

    def get_bank_by_name(self,user_id=None, card_name=None):
        
        try:
            if not card_name or not user_id:
                raise("missing card_name or user_id")
            
            return True, self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one({"cardName" : card_name}, sort=[("lastUpdate", -1)])
        except Exception as e:
            logger.error(e)
            return False, MSG.SOMETHING_GOES_WRONG_ENG
        
    def insert_new_bank(self,user_id=None, bank_doc=None):

        try:
            if not bank_doc or not user_id:
                raise "missing bank_doc or user_id"
            
            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(bank_doc)
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

            print(total_result)

            # Combine the "Total" document with the last documents per cardName
            combined_result = total_result + result

            return 200, combined_result
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG
        
    def delete_bank(self,user_id=None, cardName=None):
        if not cardName or not user_id:
            return 400, "Missing cardName or user_id"
        
        try:
            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].delete_many({"cardName" : cardName})
            self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].delete_many({"cardName" : cardName})
            return 200, "Bank deleted"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG
        
    def edit_bank(self, user_id=None, oldBank=None, newValues=None):
        try:
            if oldBank != newValues['cardName']:
                self.client[user_id][MONGO_VARS.BANKS_COLLECTION].update_many({"cardName" : oldBank}, {"$set" : {"cardName" : newValues['cardName']}})
                self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].update_many({"cardName" : oldBank}, {"$set" : {"cardName" : newValues['cardName']}})
            else:
                last_value_of_bank = self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one({"cardName" : oldBank}, sort=[("lastUpdate", -1)])

                if last_value_of_bank['balance'] == newValues['balance']:
                    return 400, "Nothing change"

            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(newValues)
            return 200, "Edited"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG
        
    def get_categories(self, user_id=None):
        try:
            return 200 , self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one({"type" : "budgetting-categories"})
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG
        
    def is_category_in_list(self, user_id=None, categoryId=None, operationType=None):
        try:
            result = self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one({"type": "budgetting-categories"})

            if result and operationType in result:
                return categoryId in (cat["category_id"] for cat in result[operationType])

        except Exception as e:
            logger.error(e)

        return False
        
    def is_subcategory_in_list(self, user_id=None, categoryId=None, subCategoryId=None, operationType=None):
        try:
            result = self.client[user_id][MONGO_VARS.SETTINGS_COLLECTION].find_one({"type": "budgetting-categories"})
            
            if result and operationType in result:
                for category in result[operationType]:
                    if category['category_id'] == categoryId:
                        subcategories = category.get('subcategories', [])
                        subcategory_ids = [subcat['subcategory_id'] for subcat in subcategories]
                        return subCategoryId in subcategory_ids
                    
        except Exception as e:
            logger.error(e)
        return False
    
    def add_transaction(self, user_id=None, transaction_doc=None):
        try:
            status, last_bank_update = self.get_bank_by_name(user_id=user_id, card_name=transaction_doc['cardName'])

            if status == False:
                return status, MSG.SOMETHING_GOES_WRONG_ENG

            last_balance = last_bank_update['balance']

            if transaction_doc['type'] == 'in':
                new_balance = last_balance + transaction_doc['amount']
            else:
                new_balance = last_balance - transaction_doc['amount']

            new_bank_doc = {
                "cardName" : transaction_doc['cardName'],
                "balance" : new_balance,
                "lastUpdate" : datetime.utcnow()
            }

            self.client[user_id][MONGO_VARS.BANKS_COLLECTION].insert_one(new_bank_doc)
            self.client[user_id][MONGO_VARS.TRANSACTION_COLLECTION].insert_one(transaction_doc)

            return 200, "Transaction added"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

        
        
    