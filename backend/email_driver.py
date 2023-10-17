from O365 import Account, FileSystemTokenBackend
from app_vars import EMAIL_DRIVER_SETTINGS

class EmailDriver(object):
    def __init__(self):
        super(EmailDriver, self).__init__()
        self.driver_type = 'base'
        self.client_id = EMAIL_DRIVER_SETTINGS["client_id"]
        self.client_secret = EMAIL_DRIVER_SETTINGS["client_secret"]
        self.token_path = EMAIL_DRIVER_SETTINGS["token_path"]
        self.token = FileSystemTokenBackend(token_filename=self.token_path)
        self.account = Account((self.client_id, self.client_secret), token_backend=self.token)

    def refresh_session(self):
        self.account.connection.refresh_token()

    def send_email(self, body, recipient, subject, attachements=None, attachements_root=None, cc=None):
        try:
            self.refresh_session()
        except Exception as e:
            print("Error on refreshing email token")

        try:
            message = self.account.new_message()
            if type(recipient) == str:
                new_recipient = recipient.split(";")
            else:
                new_recipient = recipient

            for count, item in enumerate(new_recipient):
                new_recipient[count] = item.strip()

            message.to.add(new_recipient)
            if cc:
                if type(cc) == str:
                    new_cc = cc.split(";")
                else:
                    new_cc = cc
                message.cc.add(new_cc)
            message.subject = subject
            message.body = body
            if attachements and len(attachements) > 0:
                for elem in attachements:
                    message.attachments.add(attachements_root+elem)
            
            resp = message.send()
        except Exception as e:
            print(str(e))
            resp = str(e)
        finally:
            return resp