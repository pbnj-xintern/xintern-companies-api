'use strict';
const CompanyHelper = require('./helpers/company')
const TOKEN_SECRET = process.env.TOKEN_SECRET
const AuthHelper = require('@pbnj-xintern/xintern-commons/util/auth_checker')
const Status = require('@pbnj-xintern/xintern-commons/util/status')
const middy = require('middy')

//--------------- LAMBDA FUNCTIONS ---------------
module.exports.updateCompany = middy(async (event) => {
	let payload = (event.body instanceof Object) ? event.body : JSON.parse(event.body)
	let companyId = event.pathParameters.company_id
	return await CompanyHelper.updateCompany(companyId, payload)
}).use(AuthHelper.verifyJWT(TOKEN_SECRET))

module.exports.addCompany = async (event, context) => {
	let payload = (event.body instanceof Object) ? event.body : JSON.parse(event.body)
	return await CompanyHelper.addCompany(payload)
}

module.exports.deleteCompany = async (event) => {
	return await CompanyHelper.deleteCompany(event.pathParameters.company_id)
}

module.exports.getTopCompanies = async () => {
	return await CompanyHelper.getTopCompanies();
}

module.exports.getAllCompanies = async () => {
	return await CompanyHelper.getAllCompanies()
}

module.exports.getCompanyLocations = async (event) => {
	return await CompanyHelper.getCompanyLocations(event.queryStringParameters.company_name)
}

module.exports.getGroupedCompaniesByName = async event => {
	let companyName = event.pathParameters.company_name

	if (!companyName)
		return Status.createErrorResponse(400, 'Company name not supplied')

	companyName = companyName.split('%20').join(' ')

	return await CompanyHelper.getGroupedCompaniesByName(companyName)
}

module.exports.getCompanies = async (event) => {
	if (!event.pathParameters.location)
		return Status.createErrorResponse(400, 'Location not supplied')

	return await CompanyHelper.getCompanies(null, null, event.pathParameters.location)
}