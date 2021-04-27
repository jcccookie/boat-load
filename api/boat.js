const { Router } = require('express');
const { ds, getEntityId, getEntityKind } = require('../datastore');
const { BOAT, LOAD } = require('../dataStoreConfig');
const dotenv = require('dotenv');
const { boatResponse, loadResponse, createLoadSelf, createCarrierSelf } = require('./functions');

const router = new Router();
const datastore = ds();
dotenv.config();
const url = process.env.APP_URL;

// Create a Boat
router.post('/', async (req, res, next) => {
  try {
    if (Object.keys(req.body).length < 3) {
      res.status(400).send({ Error: "The request object is missing at least one of the required attributes" });
    } else {
      const key = datastore.key(BOAT);
      const entity = {
        key,
        data: {
          ...req.body,
        }
      };

      await datastore.save(entity);
      const boat = await datastore.get(key);

      const id = getEntityId(boat[0]);
      const { name, type, length } = boat[0];

      res
        .status(201)
        .send(boatResponse({ id, name, type, length, url }));
    }
  } catch (error) {
    next(error);
  }
});

// View a Boat
router.get('/:boat_id', async (req, res, next) => {
  try {
    const key = datastore.key([BOAT, parseInt(req.params.boat_id, 10)]);

    datastore.get(key, (err, entity) => {
      if (!err && !entity) {
        res.status(404).send({ Error: "No boat with this boat_id exists" });
      } else {
        const id = getEntityId(entity);
        const { name, type, length, loads } = entity;

        if (loads) {
          createLoadSelf(loads);
        }

        res
          .status(200)
          .send(boatResponse({ id, name, type, length, loads, url }));
      }
    });
  } catch (error) {
    next(error);
  }
});

// View all Boats
router.get('/', async (req, res, next) => {
  try {
    let query = datastore.createQuery(BOAT).limit(3); // limit 3 boats per page

    // If the request includes a cursor query, set the start 
    if (Object.keys(req.query).includes("cursor")) {
      query = query.start(req.query.cursor);
    }

    const boatEntities = await datastore.runQuery(query);

    let results = {};

    results.boats = boatEntities[0].map(entity => {
      createLoadSelf(entity.loads);

      return boatResponse({
        id: getEntityId(entity),
        name: entity.name,
        type: entity.type,
        length: entity.length,
        loads: entity.loads,
        url
      });
    });

    // If there are more results, attach a next link to the result
    if (boatEntities[1].moreResults !== datastore.NO_MORE_RESULTS) {
      results.next = `${url}/boats?cursor=${boatEntities[1].endCursor}`;
    }

    res.status(200).send(results);
  } catch (error) {
    next(error);
  }
});


// Assign Load to Boat
router.put('/:boat_id/loads/:load_id', async (req, res, next) => {
  try {
    const keys = [
      datastore.key([BOAT, parseInt(req.params.boat_id)]),
      datastore.key([LOAD, parseInt(req.params.load_id)])
    ];

    const [boatKey, loadKey] = keys;
    const entities = await datastore.get(keys);

    // Check if either boat_id or load_id is valid
    if (entities[0].length < 2) {
      const error = new Error("Invalid Boat or Load Id");
      error.statusCode = 404;

      throw error;
    }

    let boatEntity, loadEntity;

    // Define variables for entities from Datastore based on kind
    entities[0].forEach(entity => {
      if (getEntityKind(entity) === BOAT) {
        boatEntity = entity;
      } else if (getEntityKind(entity) === LOAD) {
        loadEntity = entity;
      }
    });

    // Check if the load is already assigned to a boat
    if (loadEntity.carrier) {
      const error = new Error("A load is already assigned to another boat");
      error.statusCode = 403;

      throw error;
    }

    // Update Boat
    // Create a boat entity to update
    const boatToBeUpdated = {
      key: boatKey,
      data: {
        name: boatEntity.name,
        type: boatEntity.type,
        length: boatEntity.length,
        loads: boatEntity.loads ? [...boatEntity.loads]: []
      }
    };

    // Load to be updated to boat
    const loadToBoat = {
      id: getEntityId(loadEntity)
    };

    boatToBeUpdated.data.loads.push(loadToBoat);// Put load information to boat entity
    await datastore.update(boatToBeUpdated);// Update loads to boat in Datastore

    // Update Load
    // Create and update Load entity
    const loadToBeUpdated = {
      key: loadKey,
      data: {
        volume: loadEntity.volume,
        content: loadEntity.content,
        creation_date: loadEntity.creation_date,
        carrier: {
          id: getEntityId(boatEntity),
          name: boatEntity.name
        }
      }
    };

    // Update Entity 
    await datastore.update(loadToBeUpdated);

    // Get updated Boat and Load so we send response to client
    const updatedBoat = await datastore.get(boatKey);
    const updatedLoad = await datastore.get(loadKey);

    // Attach self url to every load in boat
    createLoadSelf(updatedBoat[0].loads);

    // Attach self url to carrier in load
    createCarrierSelf(updatedLoad[0].carrier);

    res
      .status(200)
      .json({
        boat: boatResponse({
          id: getEntityId(updatedBoat[0]),
          name: updatedBoat[0].name,
          type: updatedBoat[0].type, 
          length: updatedBoat[0].length,
          loads: updatedBoat[0].loads,
          url
        }),
        load: loadResponse({
          id: getEntityId(updatedLoad[0]),
          volume: updatedLoad[0].volume,
          content: updatedLoad[0].content,
          creation_date: updatedLoad[0].creation_date,
          carrier: updatedLoad[0].carrier,
          url
        })
      });
  } catch (error) {
    next(error);
  }
});

// Remove a Load from a Boat
router.delete('/:boat_id/loads/:load_id', async (req, res, next) => {
  try {
    const keys = [
      datastore.key([BOAT, parseInt(req.params.boat_id)]),
      datastore.key([LOAD, parseInt(req.params.load_id)])
    ];

    const [boatKey, loadKey] = keys;
    const entities = await datastore.get(keys);

    // Check if either boat_id or load_id is valid
    if (entities[0].length < 2) {
      const error = new Error("Invalid Boat or Load Id");
      error.statusCode = 404;

      throw error;
    }

    let boatEntity, loadEntity;

    // Define variables for entities from Datastore based on kind
    entities[0].forEach(entity => {
      if (getEntityKind(entity) === BOAT) {
        boatEntity = entity;
      } else if (getEntityKind(entity) === LOAD) {
        loadEntity = entity;
      }
    });

    // Delete the load from the Boat
    const deletedLoads = boatEntity.loads.filter(load => load.id !== req.params.load_id);
    
    // Check if the load is in the boat
    if (deletedLoads.length === boatEntity.loads.length) {
      const error = new Error("The load is not in the boat");
      error.statusCode = 403;

      throw error;
    }

    // Delete a carrier from a load
    const loadToBeUpdated = {
      key: loadKey,
      data: {
        volume: loadEntity.volume,
        content: loadEntity.content,
        creation_date: loadEntity.creation_date
      }
    };

    // Updated removed loads to the boat
    const boatToBeUpdated = {
      key: boatKey,
      data: {
        name: boatEntity.name,
        type: boatEntity.type,
        length: boatEntity.length,
        loads: deletedLoads
      }
    };

    await datastore.update(boatToBeUpdated);
    await datastore.update(loadToBeUpdated);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Delete a boat
router.delete('/:boat_id', async (req, res, next) => {
  try {
    const boatKey = datastore.key([BOAT, parseInt(req.params.boat_id)]);

    // Get loads to delete carrier info in load
    const boatEntity = await datastore.get(boatKey);

    if (boatEntity[0] === undefined) {
      const error = new Error("Invalid Boat Id");
      error.statusCode = 404;

      throw error;
    }

    // Find loads and delete its carrier
    if (boatEntity[0].loads) {
      boatEntity[0].loads.forEach(async load => {
        try {
          const loadKey = datastore.key([LOAD, parseInt(load.id)]);
          const loadEntity = await datastore.get(loadKey);
  
          if (loadEntity[0] === undefined) {
            const error = new Error("Invalid Load Id");
            error.statusCode = 404;
      
            throw error;
          } 
  
          // Delete a carrier from a load
          const loadToBeUpdated = {
            key: loadKey,
            data: {
              volume: loadEntity[0].volume,
              content: loadEntity[0].content,
              creation_date: loadEntity[0].creation_date
            }
          };
  
          await datastore.update(loadToBeUpdated);
        } catch (error) {
          throw error;
        }
      });
    }

    await datastore.delete(boatKey);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Get all loads for a given boat
router.get('/:boat_id/loads', async (req, res, next) => {
  try {
    const boatKey = datastore.key([BOAT, parseInt(req.params.boat_id)]);
    const boatEntity = await datastore.get(boatKey);

    if (boatEntity[0] === undefined) {
      const error = new Error("Invalid Boat Id");
      error.statusCode = 404;

      throw error;
    }

    let loadKeys = [];

    // Get loads from datastore to store it to container
    const loadsToBeDisplayed = boatEntity[0].loads;

    // Get loadKeys for all loads in a boat
    loadsToBeDisplayed.forEach(load => {
      const loadKey = datastore.key([LOAD, parseInt(load.id)]);

      loadKeys.push(loadKey);
    })

    const loadEntities = await datastore.get(loadKeys);

    let loadContainer = [];
    // Put self link to carrier and put load to container to be sent as response
    loadEntities[0].forEach(load => {
      createCarrierSelf(load.carrier);

      loadContainer.push(loadResponse({
        id: getEntityId(load),
        volume: load.volume,
        content: load.content,
        creation_date: load.creation_date,
        carrier: load.carrier,
        url
      }));
    });

    res.status(200).send(loadContainer);
  } catch (error) {
    next(error);
  }
});

module.exports = router