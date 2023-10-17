from pymongo import MongoClient
import app_vars as VARS
import logging
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

class BaseMongo(object):
    """
    BaseMongo class. Extend it based on apps. 
    Useful only for connection.
    """

    def __init__(self):
        """
        Create client connection
        """
        super(BaseMongo, self).__init__()
        # self.client = MongoClient(
        #     VARS.MONGO_HOST,
        #     tls=True,
        #     authSource='$external',
        #     authMechanism='MONGODB-X509',
        #     tlsAllowInvalidHostnames=True,
        #     tlsCAFile=VARS.TLSCAFILE,
        #     tlsCertificateKeyFile=VARS.TLSCERTIFICATEKEYFILE
        # )

         # Read MongoDB secrets from Docker secrets
        mongodb_username = open(VARS.mongodb_username, 'r').read().strip()
        mongodb_password = open(VARS.mongodb_password, 'r').read().strip()
        self.client = MongoClient(VARS.MONGO_HOST, username=mongodb_username, password=mongodb_password)