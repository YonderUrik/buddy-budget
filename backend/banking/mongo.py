
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging

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
            
            return True, self.client[user_id][MONGO_VARS.BANKS_COLLECTION].find_one({"cardName" : card_name})
        except Exception as e:
            logger.error(e)
            return False, MSG.SOMETHING_GOES_WRONG_ENG
        
    def insert_new_bank(self,user_id=None, bank_doc=None):

        try:
            print(user_id, bank_doc)
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
                        '_id': '$_id',
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
            total_pipeline = [
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
            total_result = list(collection.aggregate(total_pipeline))

            # Combine the "Total" document with the last documents per cardName
            combined_result = total_result + result

            return 200, combined_result
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG
        
        
    