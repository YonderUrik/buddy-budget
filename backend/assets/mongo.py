
from mongo_base import BaseMongo
import mongo_vars as MONGO_VARS
import app_msgs as MSG
import logging

logger = logging.getLogger(__name__)
class AssetsMongo(BaseMongo):
    """
    Mongo driver for authentication queries
    """
    def __init__(self):
        """
        Init AssetsMongo -> Extend BaseMongo 
        """
        super(AssetsMongo, self).__init__()

    def get_known_assets(self, keyword=None):
        pass

    def save_already_known_assets(self, docs):
        try:
            pass
        except Exception as e:
            pass
        