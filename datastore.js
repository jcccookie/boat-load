// Imports the Google Cloud client library
const { Datastore } = require('@google-cloud/datastore');

module.exports = {
  ds: () => {
    return new Datastore();
  },

  fromDatastore: item => {
    item.id = item[Datastore.KEY].id;
    return item;
  },

  getEntityId: item => {
    return item[Datastore.KEY].id;
  },

  getEntityKind: item => {
    return item[Datastore.KEY].kind;
  }
}