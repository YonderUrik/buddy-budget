
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging
from datetime import datetime
from bson.objectid import ObjectId
from dateutil.relativedelta import relativedelta


logger = logging.getLogger(__name__)
class AccountMongo(BaseMongo):
    """
    Mongo driver for banking queries
    """
    def __init__(self):
        """
        Init AccountMongo -> Extend BaseMongo 
        """
        super(AccountMongo, self).__init__()



    def change_password(self, email=None, newPassword=None):
        try:
            if not email or not newPassword:
                raise Exception("missing data")
            self.client[MONGO_VARS.DB_NAME][MONGO_VARS.USERS_COLLECTION].update_one({"email" : email}, {"$set" : {"password" : newPassword}})

            return 200, "new password set"
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG

    