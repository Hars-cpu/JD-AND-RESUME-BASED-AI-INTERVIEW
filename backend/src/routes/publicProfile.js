/**
 * @file publicProfile.js
 * @summary Public Profile express router. Handles matching HTTP GET requests for public usernames
 *          and routes them to the public profile fetch controller.
 * 
 * @routes
 * - GET /:username : Resolves and returns candidate public profiles, achievements, and heatmaps.
 */

const express = require('express');
const { getPublicProfile } = require('../controllers/interview/publicProfileController');

const publicProfileRouter = express.Router();

publicProfileRouter.get('/:username', getPublicProfile);

module.exports = publicProfileRouter;
