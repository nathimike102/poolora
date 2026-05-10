# Car Pooling Application

This is a Product Requirements Document for a Smart Scheduled Car Pooling Platform ("Share Seats. Save Costs. Travel Smarter").

# Key Points:

Problem & Opportunity
-> Addresses high commuting costs, traffic congestion, and underutilized vehicle capacity
-> Market gap: focuses on pre-planned rides vs. instant ride-hailing

Product Overview
-> Mobile app (IOS/apk) where drivers post scheduled rides and riders search/request seats
-> Payment-based confirmation with notifications
-> Web admin dashboard

Users & Roles
-> Drivers, Riders, and Admin with distinct capabilities
-> Target: students, office workers, and daily commuters

Features
-> Phone + OTP authentication
-> Ride creation (location, time, price, seats)
-> Ride search and requests
-> Razorpay payment integration
-> Firebase notifications
-> Admin panel for user/ride management
-> Technical Stack
-> Chat
-> ratings
-> real-time tracking
-> ride sharing
-> Route Deviation Alerts (Geofencing)
-> Safe Pickup & Drop Points
-> periodical time check-ins when feeling at an unease
-> Waiting Safety Features
-> surge pricing

    -> Google Maps integration
    	-> for routing (dijkstra's algorithm or google maps api (uses a* algorithm)
    	-> for future improvements, combine both algorithms
    		- dijkstra used for base road graph
    		- a* for real-time navigation


    -> AI recommendations
    	1. smart ride matching(integration of ai)
    	===========================================
    	-> using ml-based matching score - distance from passenger route
    									- time difference
    									- driver and passenger rating
    									- acceptance rate
    	-> this helps avoid showing too many irrelevant rides or passengers

    	2. intelligent pickup optimization
    	==================================
    	-> who to pick up first - use vehicle routing problem & travelling salesman problem algorithms
    							- can use greedy algorithm + distance matrix for a practical approach (sort by min detour distance)

    	3. smart visibility (who sees ride first)
    	==========================================
    	-> rule based + ai hybrid - passenger see request if within range of x km of route
    							- seat availability is greater 0
    							- time deviation is less than x minutes

    	4. fraud & no-show detection
    	=============================
    	-> train an openai model to detect - frequent cancellations
    										- fake bookings
    										- payment failures
    	-> (do research on algorithms for this)

    	5. Demand prediction
    	=====================
    	-> predict peak times, and high-demand routes
    	-> use to suggest pricing and when to post rides
    	-> (do research on algorithms for this)
    	-> also used to learn the best routes based on traffic.

    	6. Safe for her
    	================
    	-> Women-Only Ride Option - Filter for female drivers/passengers with verification
    	-> Emergency SOS Button - One-tap panic button that alerts emergency contacts and admin
    	-> Live Trip Sharing - Share real-time location and trip details with trusted contacts
    	-> Verified Driver Program - Enhanced background checks and verification badges
    	-> Safety Check-ins - Automated wellness prompts during rides
    	-> In-App Safety Tools - Fake call feature, recording options, emergency numbers
    	-> Safe Route Preferences - AI-suggested routes prioritizing well-lit, busy areas
    	-> Ride Safety Ratings - Separate safety ratings with confidential feedback
    	-> Pre-Ride Information - Full transparency on driver credentials before booking
    	-> 24/7 Safety Support - Dedicated helpline and priority chat support

Frontend: React Native
Backend: Node.js + Express
Database: MongoDB
APIs: Google Maps, Razorpay, Firebase

Project Details
6-member team
Daily coordination (no formal Agile)
Focus on core flow: Create Ride → Search → Request → Accept → Pay → Confirm
