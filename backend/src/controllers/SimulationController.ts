import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { RideSimulationService } from '../services/RideSimulationService';

const simulationService = new RideSimulationService();

/** Optional { lat, lng } in the body: where the simulated ride should start. */
function nearFrom(body: { lat?: unknown; lng?: unknown } | undefined) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return valid && !(lat === 0 && lng === 0) ? { lat, lng } : undefined;
}

export class SimulationController {
  /**
   * GET /dev/simulate
   * Whether this server allows ride simulation, so the app can show the tools.
   */
  static status(req: Request, res: Response): void {
    sendSuccess(res, { enabled: simulationService.isEnabled() }, 200, req.requestId);
  }

  /**
   * POST /dev/simulate/as-rider
   * A bot driver gives you a ride starting from { lat, lng }.
   */
  static async asRider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await simulationService.simulateAsRider(user.userId, { near: nearFrom(req.body) });
      sendSuccess(res, result, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /dev/simulate/as-driver
   * A bot rider requests a seat on { rideId }, or on a new ride from { lat, lng }.
   */
  static async asDriver(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const rideId = typeof req.body?.rideId === 'string' ? req.body.rideId : undefined;
      const result = await simulationService.simulateAsDriver(user.userId, { rideId, near: nearFrom(req.body) });
      sendSuccess(res, result, 201, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /dev/simulate/rides/:id/drive
   * Move your started ride along its route in place of real GPS.
   */
  static async drive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const result = await simulationService.driveRide(String(req.params.id), user.userId);
      sendSuccess(res, result, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /dev/simulate/rides/:id/stop
   */
  static async stop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const stopped = await simulationService.stop(String(req.params.id), user.userId);
      sendSuccess(res, { stopped }, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
