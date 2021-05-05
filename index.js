"use strict";

const http = require('http');
const axios = require('axios');
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const fromEmail = process.env.FROM_EMAIL;

let counter = 0;

// dataBase
const db = {
    "user1": [{
        "email" : process.env.USER1_EMAIL,
        "district_id" : ['96', '94', '97'],
        "is_active" : true,
    }],
    "user2": [{
        "email" : process.env.USER2_EMAIL,
        "district_id" : ['265', '294'],
        "is_active" : true,
    }],
    "user3": [{
        "email" : process.env.USER3_EMAIL,
        "district_id" : ['105'],
        "is_active" : true,
    }],
};

// date modifier
Date.prototype.addDays = async function(days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

// main
const init = async () => {
    for (let person in db) {
        // do not process inactive user
        if(!db[person][0].is_active) continue;

        let districtArray = db[person][0].district_id;
        let email = db[person][0].email;
        districtArray.map( async district => {
            let uniqueResult = [];
            let results = [];
            let resultMaxDate = new Date();
            let dis = district;
            const days = 30;
            let date = new Date().toJSON().slice(0,10);
            const availableCheck =  true;
            try {
                // loop to check for different dates
                for (let d = 0; d < days; d++) {
                    date = new Date(date);
                    let newDate = await date.addDays(d);

                    // check if data for this date is already fetched
                    if (newDate.getTime() < resultMaxDate.getTime()) continue;

                    newDate = newDate.toJSON().slice(0,10).split('-').reverse().join('-');

                    let URL = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=${dis}&date=${newDate}`;

                    const api = await axios.get(URL);
                    const resp = api.data;

                    // break if api returns null
                    if (resp.centers.length === 0){
                        break;
                    }

                    for (let i = 0; i < resp.centers.length; i++) {
                        for (let j = 0; j < resp.centers[i].sessions.length; j++) {

                            // bechare gov API se load kam krne ki ninja technique
                            let resultDate = resp.centers[i].sessions[j].date;
                            let resultDateForComparison = new Date(resultDate.split('-').reverse().join('-'));
                            if (resultDateForComparison.getTime() > resultMaxDate.getTime()) {
                                resultMaxDate = resultDateForComparison;
                            }

                            if (resp.centers[i].sessions[j].min_age_limit === 18) {
                                if (availableCheck) {
                                    if (resp.centers[i].sessions[j].available_capacity === 0) {
                                        continue;
                                    }
                                }
                                let blockName = resp.centers[i].block_name;
                                let name = resp.centers[i].name;
                                let cap = resp.centers[i].sessions[j].available_capacity;
                                let resultDate = resp.centers[i].sessions[j].date;
                                let ageLimit = resp.centers[i].sessions[j].min_age_limit;
                                let pincode = resp.centers[i].pincode;
                                let sessionId = resp.centers[i].sessions[j].session_id;

                                if (!uniqueResult.includes(sessionId)) {
                                    uniqueResult.push(sessionId);
                                    let result = `<ul>
                                        <li>&nbsp;&nbsp; Block name : <span>${blockName}</span></li>
                                        <li>&nbsp;&nbsp; Name : <span>${name}</span></li>
                                        <li>&nbsp;&nbsp; Available capacity : <span>${cap}</span></li>
                                        <li>&nbsp;&nbsp; Date : <span>${resultDate}</span></li>
                                        <li>&nbsp;&nbsp; Min Age Limit : <span>${ageLimit}</span></li>
                                        <li>&nbsp;&nbsp; Pincode : <span>${pincode}</span></li>
                                    </ul> `;
                                    results.push(result);
                                }
                            }
                        }
                    }
                }

                if (results.length > 0) {
                    let html = '';
                    await results.map( data => {
                        html += data + '<br/>'
                    });
                    await sendMail(html, email)
                    // if a mail is successfully sent to the users for his/her requirements
                    // then inactive that user
                    db[person][0].is_active = false;
                }
            } catch (e){
                console.log(e);
            }
        });
    }
}


const sendMail = async (message, email) => {
    const msg = {
        to: email,
        from: fromEmail,
        subject: 'Covid 18+ Vaccine Alert',
        html: `<code>${message}</code>`,
    }

    sgMail
        .send(msg)
        .then((response) => {
            if (response[0].statusCode !== 202) {
                console.log('status code', response[0].statusCode);
                console.log('headers', response[0].headers);
            }
        })
        .catch((error) => {
            console.error(error)
        })

}

// server front
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(`covid-script-running...${counter}`);
    res.end();
}).listen(8080);

console.log('script starts...');
setInterval(() => {
    init();
    counter++;
}, 60000)
