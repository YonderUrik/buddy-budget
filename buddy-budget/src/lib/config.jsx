const APP_NAME = "Buddy Budget"
const APP_DOMAIN_NAME = "buddybudget.net"
const SUPPORT_EMAIL_NAME = "support"
const AUTH_EMAIL_NAME = "auth"

export const config = {
    appName: APP_NAME,
    appDomainName: APP_DOMAIN_NAME,
    supportEmail : `${SUPPORT_EMAIL_NAME}@${APP_DOMAIN_NAME}`,
    authenticationEmail : `${AUTH_EMAIL_NAME}@${APP_DOMAIN_NAME}`
}

export const currencies = [
    {code : "USD", name : "United States Dollar ($)"}
]

export const dateFormats = [
    {value : "MM/DD/YYYY" , label : "MM/DD/YYYY"}
]