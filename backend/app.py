import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
import app_vars as VARS

# Set logging parameters like format, dateformat location etc..
logging.basicConfig(
    format='[%(name)s:%(funcName)20s():%(lineno)s] - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.INFO,
    handlers=[
        logging.FileHandler("debug.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Set-up Flask app
app = Flask(__name__)

# Set-up Cors with supports_credentials (Authorization in Cookie)
# Allow localhost:3000 for development
CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

# Set JWT Token with expires time
jwt = JWTManager(app)
app.config['JWT_SECRET_KEY'] = VARS.JWT_SECRET_KEY
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)


# Here you can globally configure all the ways you want to allow JWTs to be sent to your web application. 
# By default, this will be only headers.
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]

# If true this will only allow the cookies that contain your JWTs to be sent
# over https. In production, this should always be set to True
app.config["JWT_COOKIE_SECURE"] = True

# Enable csrf double submit protection.
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_CSRF_CHECK_FORM'] = True

# Custom error handler for 404 Not Found
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not Found'}), 404

# Custom error handler for 400 Bad Request
@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad Request'}), 400

# Custom error handler for 401 Unauthorized
@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401

# Custom error handler for 403 Forbidden
@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden'}), 403

# Custom error handler for 500 Internal Server Error
@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({'error': 'Internal Server Error'}), 500

import authentication.authentication as auth
app.register_blueprint(auth.bp)
import banking.banking as banking
app.register_blueprint(banking.bp)
import account.account as account
app.register_blueprint(account.bp)

if __name__ == "__main__":
    app.run(host=VARS.HOST_NAME,debug=True, port=VARS.APP_PORT)