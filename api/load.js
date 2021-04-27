const { Router } = require('express');
const { ds, getEntityId } = require('../datastore');
const { BOAT, LOAD } = require('../dataStoreConfig');
const dotenv = require('dotenv');
const { boatResponse, loadResponse, createCarrierSelf } = require('./functions');

const router = new Router();
const datastore = ds();
dotenv.config();
const url = process.env.APP_URL;

// Create a Load
router.post('/', async (req, res, next) => {
  try {
    if (Object.keys(req.body).length < 3) {
      res.status(400).send({ Error: "The request object is missing at least one of the required attributes" });
    } else {
      const key = datastore.key(LOAD);
      const entity = {
        key,
        data: {
          ...req.body
        }
      };

      await datastore.save(entity);
      const load = await datastore.get(key);

      const id = getEntityId(load[0]);
      const { volume, content, creation_date } = load[0];

      res
        .status(201)
        .send(loadResponse({ id, volume, content, creation_date, url }));
    }
  } catch (error) {
    next(error);
  }
});

// View a Load
router.get('/:load_id', async (req, res, next) => {
  try {
    const key = datastore.key([LOAD, parseInt(req.params.load_id, 10)]);

    datastore.get(key, (err, entity) => {
      if (!err && !entity) {
        res.status(404).send({ Error: "No load with this load_id exists" });
      } else {
        const id = getEntityId(entity);
        const { volume, content, creation_date, carrier } = entity;

        if (carrier) {
          createCarrierSelf(carrier);
        }

        res
          .status(200)
          .send(loadResponse({ id, volume, content, creation_date, carrier, url }));
      }
    });
  } catch (error) {
    next(error);
  }
});

// View all Loads
router.get('/', async (req, res, next) => {
  try {
    let query = datastore.createQuery(LOAD).limit(3); // limit 3 loads per page

    // If the request includes a cursor query, set the start 
    if (Object.keys(req.query).includes("cursor")) {
      query = query.start(req.query.cursor);
    }

    const loadEntities = await datastore.runQuery(query);

    console.log(loadEntities);

    let results = {};

    results.loads = loadEntities[0].map(entity => {
      createCarrierSelf(entity.carrier);

      return loadResponse({
        id: getEntityId(entity),
        volume: entity.volume,
        content: entity.content,
        creation_date: entity.creation_date,
        carrier: entity.carrier,
        url
      });
    });

    // If there are more results, attach a next link to the result
    if (loadEntities[1].moreResults !== datastore.NO_MORE_RESULTS) {
      results.next = `${url}/loads?cursor=${loadEntities[1].endCursor}`;
    }

    res.status(200).send(results);
  } catch (error) {
    next(error);
  }
});

// Delete a Load
router.delete('/:load_id', async (req, res, next) => {
  try {
    const loadKey = datastore.key([LOAD, parseInt(req.params.load_id, 10)]);
    const loadEntity = await datastore.get(loadKey);

    if (loadEntity[0] === undefined) {
      const error = new Error("Invalid Load Id");
      error.statusCode = 404;

      throw error;
    }
      
    // Delete a load in the boat if carrier exist
    if (loadEntity[0].carrier) {
      const boatId = loadEntity[0].carrier.id;
      const boatKey = datastore.key([BOAT, parseInt(boatId)]);
      const boatEntity = await datastore.get(boatKey);

      if (boatEntity[0] === undefined) {
        const error = new Error("Invalid Boat Id");
        error.statusCode = 404;
  
        throw error;
      }
        
      const deletedLoads = boatEntity[0].loads.filter(load => load.id !== req.params.load_id);

      if (deletedLoads.length === boatEntity[0].loads.length) {
        const error = new Error("The load is not in the boat");
        error.statusCode = 403;

        throw error;
      }

      const boatToBeUpdated = {
        key: boatKey,
        data: {
          name: boatEntity[0].name,
          type: boatEntity[0].type,
          length: boatEntity[0].length,
          loads: deletedLoads
        }
      };

      await datastore.update(boatToBeUpdated);
    }

    await datastore.delete(loadKey);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});


module.exports = router