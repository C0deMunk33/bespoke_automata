
const WEAVIATE_URL = 'http://192.168.0.7:8080'

async function initSchema(new_schema){
    // fetch current schema
    const currentSchema = await fetchSchema();

    // for each class in new_schema (array), check that class.class exists, if not, create it based on class.properties
    for (let i = 0; i < new_schema.length; i++) {
        const className = new_schema[i].class;
        const classProperties = new_schema[i].properties;
        const classDescription = new_schema[i].description;
        console.log("className", className)
        // check if class exists in currentSchema.classes
        const classExists = currentSchema.classes.find(c => c.class === className);
        if(!classExists){
            await createClass(className, classProperties);
        } 
    }
}

async function wipeSchema(){
    // fetch current schema
    const currentSchema = await fetchSchema();
    console.log("currentSchema", currentSchema)
    // delete each class in schema (array)
    for (let i = 0; i < currentSchema.classes.length; i++) {
        const className = currentSchema.classes[i].class;

        await deleteClass(className);
    }
}


async function fetchSchema() {
    try {
        const response = await fetch(WEAVIATE_URL + `/v1/schema`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to fetch schema:', error);
        return null;
    }
}

async function createClass(className, properties) {
    // Check if the class already exists
    const schema = await fetchSchema();
    const classExists = schema.classes.find(c => c.class === className);
    if (classExists) {
        return;
    }

    const classDefinition = {
        "class": className,
        "properties": properties,
        "vectorizer": "text2vec-contextionary",
        "moduleConfig": {
          "text2vec-contextionary": {
            "vectorizeClassName": "false"
          }
        }
    };

    const response = await fetch(`${WEAVIATE_URL}/v1/schema/`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(classDefinition)
    });

}
/*
const bookProperties = [
    {
        "name": "title",
        "dataType": ["string"]
    },
    {
        "name": "author",
        "dataType": ["string"]
    },
    {
        "name": "publishedDate",
        "dataType": ["string"] // Consider using an appropriate date-time format or a different datatype
    },
    {
        "name": "genre",
        "dataType": ["string"]
    }
];
*/
// Example usage:
// createClass("Book", bookProperties);

/**
 * Weaviate Data Types Primer
 *
 * When defining your schema in Weaviate, you specify the data type for each property.
 * The following outlines the primary data types you can use:
 *
 * Primitives:
 * - "string": A sequence of characters.
 * - "int": A whole number, either positive or negative.
 * - "number" (or "float"): A number that can have a fractional part.
 * - "boolean": A true or false value.
 * - "date": A date in the format "2006-01-02T15:04:05.999999999Z07:00" (RFC 3339).
 *
 * Reference Types:
 * - Other Class Names: Establish relations between classes. If you have a class "Author" and another class "Book", 
 *   the "Book" class can have a property "writtenBy" with a data type of "Author" to create a relation.
 *
 * Special Types:
 * - "geoCoordinates": An object representing geographical coordinates. It has two properties: "latitude" and "longitude".
 *
 * Arrays of Primitives or References:
 * - If a property can hold multiple values, you can define it as an array. Examples:
 *   - ["string"]: An array of strings.
 *   - ["int"]: An array of integers.
 *   - ["Author"]: An array of references to the "Author" class.
 *
 * When setting up your schema, it's crucial to choose the appropriate data type for each property.
 * This choice ensures data integrity and determines how you can query and analyze the data.
 *
 * For the most updated list and specific nuances or details of data types, always refer to Weaviate's official documentation.
 */

async function addRecord(className, data) {
    const response = await fetch(`${WEAVIATE_URL}/v1/objects`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "class": className,
            "properties": data
        })
    });

    return response.json();
}
/*
const bookData = {
    "title": "The Great Gatsby",
    "author": "F. Scott Fitzgerald",
    "publishedDate": "1925-04-10",
    "genre": "Novel"
};*/
// Example usage:
// addRecord("Book", bookData);

async function queryClass(className, queryText) {
    const response = await fetch(`${WEAVIATE_URL}/v1/objects?q=${encodeURIComponent(queryText)}&classes[]=${className}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    return response.json();
}
// Example usage:
//queryClass("ExampleClass", "Some value");

async function deleteRecord(className, recordId) {
    const response = await fetch(`${WEAVIATE_URL}/v1/${className}/${recordId}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (response.ok) {
        console.log(`Record with ID ${recordId} from ${className} deleted successfully.`);
    } else {
        console.error(`Failed to delete record with ID ${recordId} from ${className}. Status: ${response.status}`);
    }

    return response;
}
// Example usage:
// deleteRecord("ExampleClass", "recordID-to-delete");

async function deleteClass(className) {
    const response = await fetch(`${WEAVIATE_URL}/v1/schema/${className}`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (response.ok) {
        console.log(`Class ${className} deleted successfully.`);
    } else {
        console.error(`Failed to delete class ${className}. Status: ${response.status}`);
    }

    return response;
}
// Example usage:
// deleteClass("ExampleClass");

async function updateRecord(className, recordId, data) {
    const response = await fetch(`${WEAVIATE_URL}/v1/${className}/${recordId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    return response.json();
}
// Example usage:
// updateRecord("ExampleClass", "recordID-to-update", { "propertyName": "New Value" });

/**
 * Versatile query function for Weaviate
 * @param {string} className - The name of the class to query.
 * @param {string} [queryText] - Text-based search query.
 * @param {Object} [filters] - Filters for more specific queries.
 * @param {string} [orderBy] - Property name to order the results by.
 * @param {boolean} [orderDescending] - If true, order results in descending order.
 * @param {number} [limit] - Limit the number of returned results.
 * @param {number} [offset] - Offset in the list of results (for pagination).
 * @returns {Promise<Object>}
 */
/**
 * Filters Primer for Weaviate
 *
 * Filters in Weaviate allow you to narrow down your query results based on specific conditions. These
 * conditions can be applied to the properties of a class.
 *
 * Basic Structure:
 * The general structure of a filter object is:
 * {
 *   "propertyName": {
 *     "type": "operatorType",
 *     "value": "valueToCompareAgainst"
 *   }
 * }
 *
 * Supported Operators:
 * 
 * - "eq": Equal to. Checks if the property's value is equal to the provided value.
 *   Example: { "propertyName": { "type": "eq", "value": "John" } }
 * 
 * - "lt": Less than. Checks if the property's value is less than the provided value.
 *   Example (for numeric properties): { "age": { "type": "lt", "value": 30 } }
 *
 * - "lte": Less than or equal to.
 *   Example: { "age": { "type": "lte", "value": 30 } }
 *
 * - "gt": Greater than.
 *   Example: { "age": { "type": "gt", "value": 20 } }
 *
 * - "gte": Greater than or equal to.
 *   Example: { "age": { "type": "gte", "value": 21 } }
 *
 * - "like": Similar to. It can be used to find objects that have similar string properties.
 *   Example: { "name": { "type": "like", "value": "Jo%" } }
 * 
 * Combining Filters:
 * You can combine multiple filter conditions. When doing so, all conditions must be satisfied (logical AND).
 *
 * Example:
 * {
 *   "name": { "type": "eq", "value": "John" },
 *   "age": { "type": "gte", "value": 21 }
 * }
 * This filter retrieves all records where the name is "John" AND age is greater than or equal to 21.
 *
 * Nested Filters:
 * For properties that are references to other objects, you can use nested filters.
 * Example, assuming 'address' is a reference to another object:
 * {
 *   "address": {
 *     "city": { "type": "eq", "value": "New York" }
 *   }
 * }
 *
 * Note: This primer covers basic filtering capabilities of Weaviate. As Weaviate evolves or if you have specific
 * modules installed, there may be more advanced filtering options available. Always refer to the Weaviate
 * documentation for the most up-to-date and comprehensive information.
 */

async function advancedQuery(className, queryText, count) {
    const url = WEAVIATE_URL+"/v1/graphql";

    const data = {
        query: `
        {
            Get{
                ` +className+ `(
                    limit: `+count+`,
                    nearText: {
                        concepts: ["`+queryText+`"],
                    }
                ){ text }
            }
        }`
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        const jsonResponse = await response.json();
        console.log(jsonResponse);
        return jsonResponse;

    } else {
        throw new Error(`Request failed with status: ${response.status}`);
    }

    
}
// Example usage:
/*
const queryOptions = {
    className: "ExampleClass",
    queryText: "search term",
    filters: {
        "propertyName": {
            "type": "eq",
            "value": "specific value"
        }
    },
    orderBy: "propertyName",
    orderDescending: true,
    limit: 10,
    offset: 0
};
advancedQuery(queryOptions).then(console.log);
*/
/**
 * Fetches a specific record by its ID.
 * @param {string} className - The name of the class the record belongs to.
 * @param {string} recordId - The unique ID of the record.
 * @returns {Promise<Object>}
 */
async function getRecordById(className, recordId) {
    const response = await fetch(`${WEAVIATE_URL}/v1/objects/${recordId}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
}
// Example usage:
// getRecordById("ExampleClass", "specific-record-id").then(console.log);

