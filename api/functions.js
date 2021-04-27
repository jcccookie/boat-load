const dotenv = require('dotenv');
dotenv.config();
const url = process.env.APP_URL;

exports.boatResponse = ({ id, name, type, length, loads, url }) => {
  return {
    id,
    name,
    type,
    length,
    loads,
    self: `${url}/boats/${id}`
  }
};

exports.loadResponse = ({ id, volume, content, creation_date, carrier, url }) => {
  return {
    id,
    volume,
    content,
    creation_date,
    carrier,
    self: `${url}/loads/${id}`
  }
};

exports.createLoadSelf = loads => {
  if (loads) {
    loads.forEach(load => {
      load.self = load.self = `${url}/loads/${load.id}`;
    });
  }
};

exports.createCarrierSelf = carrier => {
  if (carrier) {
    carrier.self = `${url}/boats/${carrier.id}`;
  }  
};