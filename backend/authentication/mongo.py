
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging

logger = logging.getLogger(__name__)
class AuthMongo(BaseMongo):
    """
    Mongo driver for authentication queries
    """
    def __init__(self):
        """
        Init AuthMongo -> Extend BaseMongo 
        """
        super(AuthMongo, self).__init__()
        
    def get_user_by_email(self, email=None):
        if not email:
            return 400, None, "No email provided"
        
        try:
            user_info = self.client[MONGO_VARS.DB_NAME][MONGO_VARS.USERS_COLLECTION].find_one({"email" : email})
            return user_info
        except Exception as e:
            logger.error(e)
            raise(str(e))

    def set_user_code(self, email=None, code=None):

        if not email or not code:
            return False, "Missing code or email"

        try:
            self.client[MONGO_VARS.DB_NAME][MONGO_VARS.USERS_COLLECTION].update_one({"email" : email}, {"$set" : {"confirm_code" : code}})
            return True, "Password resetted"
        except Exception as e:
            logger.error(e)
            return False, str(e)
        
    def set_user_new_password(self, email=None, hashed_password=None):

        if not email or not hashed_password:
            return False, "Missing email or password"
        
        try:
            self.client[MONGO_VARS.DB_NAME][MONGO_VARS.USERS_COLLECTION].update_one({"email" : email},{"$set" : {"confirm_code" : None, "password" : hashed_password}})
            return True, "Password setted"
        except Exception as e:
            logger.error(e)
            return False, str(e)
        
    def register_user(self, doc=None):
        
        if not doc:
            return 400, "Missing data"
        
        try:
            _id = self.client[MONGO_VARS.DB_NAME][MONGO_VARS.USERS_COLLECTION].insert_one(doc)

            self.client[_id.inserted_id][MONGO_VARS.SETTINGS_COLLECTION].insert_one(MONGO_VARS.DEFAULT_CATEGORIE)
            return 200, MSG.USER_REGISTERED_ENG
        except Exception as e:
            logger.error(e)
            return 500, MSG.SOMETHING_GOES_WRONG_ENG