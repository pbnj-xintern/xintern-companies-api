const Review = require('@pbnj-xintern/xintern-commons/models/Review')
const Company = require('@pbnj-xintern/xintern-commons/models/Company')
const AwsUtil = require('@pbnj-xintern/xintern-commons/util/aws')
const db = require('@pbnj-xintern/xintern-commons/util/db')
const Status = require('@pbnj-xintern/xintern-commons/util/status')
const MONGO_URL = process.env.MONGO_URL
const mongoose = require('mongoose')

const getExtension = base64 => {
    if (base64.includes('image/jpg') || base64.includes('image/jpeg'))
        return '.jpg'
    if (base64.includes('image/png'))
        return '.png'
    if (base64.includes('image/bmp'))
        return '.bmp'
    return null
}

//Returns Company obj 
const findCompanyByName = async (eventBody) => {
    try {
        let foundCompany = await db.exec(MONGO_URL, () => {
            return Company.find({ name: eventBody.company_name.trim() })
        })
        console.log('Company Found:\n', foundCompany)
        return foundCompany
    } catch (err) {
        console.error('caught err while trying to find Company:\n', err.message)
        return Status.createErrorResponse(500, "Company does not exist.")
    }
}

//Returns Company obj 
const findCompanyById = async (companyId) => {
    try {
        let foundCompany = await db.exec(MONGO_URL, () => {
            return Company.find({ _id: companyId })
        })
        console.log('Company Found:\n', foundCompany)
        if (foundCompany.length > 0) {
            foundCompany = foundCompany[0]
        } else {
            return null
        }
        return foundCompany
    } catch (err) {
        console.error('caught err while trying to find Company:\n', err.message)
    }
}


const getCompaniesByLocation = async location => {
    if (!location)
        return null

    return await db.exec(MONGO_URL, () =>
        Company.find(
            { location: { "$regex": location, "$options": "i" } },
        )
    ).catch(e => {
        console.error(e.message || e)
        return null
    })
}

module.exports.updateCompanyPicture = async (companyObj, base64) => {

    let extension = getExtension(base64)

    if (!extension)
        return Status.createErrorResponse(400, 'Incorrect image format supplied')

    let fileName = companyObj.name + '_logo' + extension
    fileName = fileName.split(' ').join('-')

    let url = await AwsUtil.uploadMultipartToS3(fileName, base64, 'company/')

    if (!url)
        return Status.createErrorResponse(500, 'Could not upload image')

    return db.exec(
        MONGO_URL,
        () => Company.findOneAndUpdate({ _id: companyObj._id }, { logo: url }).then(company => {
            return Status.createSuccessResponse(200, company)
        }).catch(err => {
            console.log(err)
            return Status.createErrorResponse(500, 'Error while finding company')
        })
    )
}

module.exports.getTopCompanies = async () => {
    let allReviews = null
    try {
        allReviews = await db.exec(MONGO_URL, () => {
            return Review.find({}).populate('company');
        });
        let companyMap = {};
        allReviews.forEach(review => {
            if (review.company) {
                companyMap[review.company.name] = review.company;
            }
        })
        let counter = {};
        allReviews.forEach(review => {
            if (review.company) {
                let company_name = review.company.name;
                counter[company_name] = counter[company_name] ? ++counter[company_name] : 1;
            }
        })
        let companyList = []
        Object.keys(counter).forEach(key => {
            companyList.push({
                _id: companyMap[key]._id,
                name: companyMap[key].name,
                count: counter[key],
                logo: companyMap[key].logo
            })
        })

        companyList.sort((a, b) => {
            return b.count - a.count;
        })
        if (companyList.length >= 12) {
            return Status.createSuccessResponse(200, companyList.slice(0, 12));
        }
        return Status.createSuccessResponse(200, companyList);


    } catch (err) {
        console.log(err);
        return Status.createErrorResponse(400, 'Could not fetch top companies');
    }
}

module.exports.deleteCompany = async (companyId) => {
    try {
        let result = await db.exec(MONGO_URL, () => {
            return Company.findOneAndDelete({
                _id: companyId
            })
        })
        if (result._id) {
            console.log('Deleted Company obj:\n', result)
            return Status.createSuccessResponse(200, {
                company_id: companyId,
                message: "Company successfully DELETED."
            })
        } else {
            return Status.createErrorResponse(400, "Could not delete company.")
        }
    } catch (err) {
        console.error('delete company caught error:', err.message)
        return Status.createErrorResponse(500, err.message)
    }
}

module.exports.getAllCompanies = async () => {
    let result = await db.exec(MONGO_URL,
        () => Company.aggregate([
            { $match: {} },
            {
                $group: {
                    _id: { $toLower: '$name' },
                    name: { $first: '$name' },
                    logo: { $first: '$logo' }
                }
            }
        ])
            .collation({ 'locale': 'en_US', numericOrdering: true })
            .sort({ _id: 'asc' })
    ).catch(e => {
        console.error(e.message || e)
        return false
    })

    if (!result)
        return Status.createErrorResponse(500, 'Could not aggregate companies')

    return Status.createSuccessResponse(200, result, "Successfully fetched companies.")
}

module.exports.getCompanyLocations = async companyName => {
    try {
        let companyList = await db.exec(MONGO_URL, () => {
            return Company.find({ name: companyName })
        })
        if (companyList.length === 0) return Status.createErrorResponse(404, "No companies found.")
        console.log('companyList:', companyList)
        let companyLocations = companyList.map(company => company.location)
        console.log('companyLocations:', companyLocations)
        return Status.createSuccessResponse(200, companyLocations)
    } catch (err) {
        console.error(err.message)
    }
}

module.exports.addCompany = async (payload) => {
    let newCompany = new Company({
        _id: new mongoose.Types.ObjectId(),
        name: payload.name,
        logo: payload.logo,
        location: payload.location
    })
    try {
        let result = await db.exec(MONGO_URL, () => {
            return newCompany.save()
        })
        if (!result._id || result === null) return Status.createErrorResponse(400, "Company could not be created.")
        return Status.createSuccessResponse(201, {
            company_id: newCompany._id,
            message: "Company successfully CREATED."
        })
    } catch (err) {
        console.error('create company caught error:', err.message)
        return Status.createErrorResponse(400, err.message)
    }
}
//updateReview 2.3
module.exports.updateCompany = async (companyId, payload) => {
    let payloadIsValid = await RequestChecker(payload, Company)
    if (!payloadIsValid) return Status.createErrorResponse(400, "payload does not match model.")
    try {
        let result = await db.exec(MONGO_URL, () => {
            return Company.findByIdAndUpdate(companyId, { //company _id
                name: payload.name,
                logo: payload.logo,
                location: payload.location
            }, { new: true })
        })
        console.log('Updated Company obj:\n', result)
        if (result)
            return Status.createSuccessResponse(204, {
                company_id: companyId,
                message: "Company successfully UPDATED."
            })
    } catch (err) {
        console.error('company does not exist:\n', err.message)
        return Status.createErrorResponse(400, err.message)
    }
}

module.exports.getGroupedCompaniesByName = async companyName => {
    let result = await db.exec(MONGO_URL,
        () => Company.aggregate([
            { $match: { name: new RegExp(companyName.toLowerCase(), 'i') } },
            {
                $group: {
                    _id: { $toLower: '$name' },
                    name: { $first: '$name' },
                    logo: { $first: '$logo' }
                }
            }
        ]).limit(10)
    ).catch(e => {
        console.error(e.message || e)
        return false
    })

    if (!result)
        return Status.createErrorResponse(500, 'Could not aggregate companies')

    return Status.createSuccessResponse(200, result, "Successfully fetched companies.")
}

module.exports.getCompanies = async (id, name, location) => {

    if (id)
        return db.exec(
            MONGO_URL,
            () => Company.findById(id).catch(err => {
                console.log(err)
                return Status.createErrorResponse(500, 'Error while finding company')
            })
        )

    let whereQuery = {}

    if (name) whereQuery.name = { "$regex": name, "$options": "i" }
    if (location) whereQuery.location = { "$regex": location, "$options": "i" }
    if (Object.keys(whereQuery).length < 1) return Status.createErrorResponse(500, 'Insufficient parameters supplied')

    let result = await db.exec(MONGO_URL, () => Company.find(whereQuery))
        .catch(e => {
            console.error(e.message || e)
            return false
        })

    if (!result)
        return Status.createErrorResponse(500, 'Could not find companies')

    return Status.createSuccessResponse(200, result, "Successfully fetched companies.")
}

module.exports.findCompanyByName = findCompanyByName;

module.exports.findCompanyById = findCompanyById;