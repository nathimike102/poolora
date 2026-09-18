import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import {
  autocomplete,
  geocodeAddress,
  reverseGeocode,
  getRoute,
  calculateDistance,
  getDirections,
  findNearestDriver,
  getTrafficAwareRoute,
  detectGeolocation,
  optimizeRoute,
  getNavigationData,
  searchPlacesGrounded,
  searchNearbyPlaces,
  validateAddress,
} from '../services/MapsService';

export class MapsController {
  /**
   * GET /maps/geocode?address=...
   * Coordinates for an address the rider picked from suggestions.
   */
  static async geocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await geocodeAddress(String(req.query.address));
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /maps/reverse-geocode?lat=...&lng=...
   * Address for a point the rider pinned on the map.
   */
  static async reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = req.query as unknown as { lat: number; lng: number };
      const result = await reverseGeocode(lat, lng);
      sendSuccess(
        res,
        { formattedAddress: result.formattedAddress, placeId: result.placeId, lat, lng },
        200,
        (req as AuthenticatedRequest).requestId,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /maps/autocomplete?input=...
   * Place suggestions. Proxied so the Google API key never ships in the app.
   */
  static async autocomplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await autocomplete(String(req.query.input));
      sendSuccess(res, { results }, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/directions?originLat=...&originLng=...&destLat=...&destLng=...
   * Get driving route between two points.
   */
  static async directions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const originLat = parseFloat(req.query.originLat as string);
      const originLng = parseFloat(req.query.originLng as string);
      const destLat = parseFloat(req.query.destLat as string);
      const destLng = parseFloat(req.query.destLng as string);
      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        res.status(400).json({
          success: false,
          message: 'originLat, originLng, destLat, destLng query parameters are required',
        });
        return;
      }
      const result = await getRoute(
        { lat: originLat, lng: originLng },
        { lat: destLat, lng: destLng },
      );
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/distance?originLat=...&originLng=...&destLat=...&destLng=...
   * Calculate driving distance and duration between two points.
   */
  static async distance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const originLat = parseFloat(req.query.originLat as string);
      const originLng = parseFloat(req.query.originLng as string);
      const destLat = parseFloat(req.query.destLat as string);
      const destLng = parseFloat(req.query.destLng as string);
      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        res.status(400).json({
          success: false,
          message: 'originLat, originLng, destLat, destLng query parameters are required',
        });
        return;
      }
      const result = await calculateDistance(
        { lat: originLat, lng: originLng },
        { lat: destLat, lng: destLng },
      );
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/pickup-to-drop?pickupLat=...&pickupLng=...&dropLat=...&dropLng=...
   * Get detailed step-by-step directions from pickup to drop point.
   * Optional query: waypoints=lat1,lng1|lat2,lng2
   */
  static async pickupToDrop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pickupLat = parseFloat(req.query.pickupLat as string);
      const pickupLng = parseFloat(req.query.pickupLng as string);
      const dropLat = parseFloat(req.query.dropLat as string);
      const dropLng = parseFloat(req.query.dropLng as string);

      if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropLat) || isNaN(dropLng)) {
        res.status(400).json({
          success: false,
          message: 'pickupLat, pickupLng, dropLat, dropLng query parameters are required',
        });
        return;
      }

      // Parse optional waypoints: "lat1,lng1|lat2,lng2"
      let waypoints: Array<{ lat: number; lng: number }> | undefined;
      if (req.query.waypoints) {
        waypoints = (req.query.waypoints as string).split('|').map((wp) => {
          const [lat, lng] = wp.split(',').map(Number);
          return { lat, lng };
        });
      }

      const result = await getDirections(
        { lat: pickupLat, lng: pickupLng },
        { lat: dropLat, lng: dropLng },
        waypoints,
      );
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/nearest-driver
   * Find the nearest driver from a list of driver locations to a pickup point.
   * Body: { drivers: [{ lat, lng }, ...], pickup: { lat, lng } }
   */
  static async nearestDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { drivers, pickup } = req.body;

      if (!Array.isArray(drivers) || !drivers.length) {
        res.status(400).json({
          success: false,
          message: 'drivers array with at least one { lat, lng } object is required',
        });
        return;
      }

      if (!pickup || typeof pickup.lat !== 'number' || typeof pickup.lng !== 'number') {
        res.status(400).json({
          success: false,
          message: 'pickup object with lat and lng is required',
        });
        return;
      }

      const result = await findNearestDriver(drivers, pickup);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/traffic-route?originLat=...&originLng=...&destLat=...&destLng=...
   * Get traffic-aware routes with alternative options.
   * Optional query: travelMode=DRIVE|TWO_WHEELER (default: DRIVE)
   */
  static async trafficRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const originLat = parseFloat(req.query.originLat as string);
      const originLng = parseFloat(req.query.originLng as string);
      const destLat = parseFloat(req.query.destLat as string);
      const destLng = parseFloat(req.query.destLng as string);

      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        res.status(400).json({
          success: false,
          message: 'originLat, originLng, destLat, destLng query parameters are required',
        });
        return;
      }

      // Validate travelMode if provided
      const travelMode = (req.query.travelMode as string)?.toUpperCase() as
        | 'DRIVE'
        | 'TWO_WHEELER'
        | undefined;
      if (travelMode && travelMode !== 'DRIVE' && travelMode !== 'TWO_WHEELER') {
        res.status(400).json({
          success: false,
          message: 'travelMode must be DRIVE or TWO_WHEELER',
        });
        return;
      }

      const result = await getTrafficAwareRoute(
        { lat: originLat, lng: originLng },
        { lat: destLat, lng: destLng },
        travelMode || 'DRIVE',
      );
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/geolocation
   * Detect device location as a backup when GPS is unavailable.
   * Body (all optional): { wifiAccessPoints: [...], cellTowers: [...] }
   */
  static async geolocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { wifiAccessPoints, cellTowers } = req.body || {};

      const result = await detectGeolocation(wifiAccessPoints, cellTowers);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/optimize-route
   * Optimize multi-stop route for the most efficient waypoint order.
   * Body: { origin: { lat, lng }, destination: { lat, lng }, waypoints: [{ lat, lng }, ...] }
   */
  static async optimizeRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { origin, destination, waypoints } = req.body;

      if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
        res.status(400).json({
          success: false,
          message: 'origin object with lat and lng is required',
        });
        return;
      }

      if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
        res.status(400).json({
          success: false,
          message: 'destination object with lat and lng is required',
        });
        return;
      }

      if (!Array.isArray(waypoints) || !waypoints.length) {
        res.status(400).json({
          success: false,
          message: 'waypoints array with at least one { lat, lng } object is required',
        });
        return;
      }

      const result = await optimizeRoute(origin, destination, waypoints);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/navigation?originLat=...&originLng=...&destLat=...&destLng=...
   * Get turn-by-turn navigation data for driving between two points.
   */
  static async navigation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const originLat = parseFloat(req.query.originLat as string);
      const originLng = parseFloat(req.query.originLng as string);
      const destLat = parseFloat(req.query.destLat as string);
      const destLng = parseFloat(req.query.destLng as string);

      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        res.status(400).json({
          success: false,
          message: 'originLat, originLng, destLat, destLng query parameters are required',
        });
        return;
      }

      const result = await getNavigationData(
        { lat: originLat, lng: originLng },
        { lat: destLat, lng: destLng },
      );
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/grounding
   * Search for real places using natural language text query (AI grounding).
   * Body: { textQuery: "...", locationBias?: { lat, lng, radiusMeters? } }
   */
  static async grounding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { textQuery, locationBias } = req.body;

      if (!textQuery || typeof textQuery !== 'string') {
        res.status(400).json({
          success: false,
          message: 'textQuery string is required',
        });
        return;
      }

      const result = await searchPlacesGrounded(textQuery, locationBias);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/maps/nearby?lat=...&lng=...&type=...&radius=...&keyword=...
   * Search for nearby places by type (police_station, gas_station, hospital, etc.).
   */
  static async nearbyPlaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const type = req.query.type as string;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5000;
      const keyword = req.query.keyword as string | undefined;

      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({
          success: false,
          message: 'lat and lng query parameters are required',
        });
        return;
      }

      if (!type) {
        res.status(400).json({
          success: false,
          message: 'type query parameter is required (e.g. police, gas_station, hospital)',
        });
        return;
      }

      const result = await searchNearbyPlaces({ lat, lng }, type, radius, keyword);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/maps/validate-address
   * Validate and correct an address using Google Address Validation API.
   * Body: { address: "...", regionCode?: "IN" }
   */
  static async validateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { address, regionCode } = req.body;

      if (!address || typeof address !== 'string') {
        res.status(400).json({
          success: false,
          message: 'address string is required',
        });
        return;
      }

      const result = await validateAddress(address, regionCode);
      sendSuccess(res, result, 200, (req as AuthenticatedRequest).requestId);
    } catch (error) {
      next(error);
    }
  }
}
