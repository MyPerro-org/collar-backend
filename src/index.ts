import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';

const app:Express = express();
const port = 3000;
app.use(bodyParser.urlencoded({ extended: true }));

// Type definitions
type DogSpecies = 'Labrador' | 'German Shepherd' | 'Golden Retriever' | 'French Bulldog' | 'Poodle' | 'Other';
type AgeGroup = 'puppy (0-1 year)' | 'adult (1-7 years)' | 'senior (7+ years)';
type Sex = 'male' | 'female';

interface SensorData {
    dog_breed: DogSpecies;
    weight: number;
    age: AgeGroup;
    sex: Sex;
    speed: number;
    ir_value: number;
    x: number;
    y: number;
    z: number;
}

class Dog {
    // Initialize the properties
    private readonly species: DogSpecies;
    private readonly weight: number;
    private readonly age: AgeGroup;
    private readonly sex: Sex;
    private readonly speed: number;

    constructor(species: DogSpecies, weight: number, age: AgeGroup, sex: Sex, speed: number) {
        // Explicitly assign the parameters to the class properties
        this.species = species;
        this.weight = weight;
        this.age = age;
        this.sex = sex;
        this.speed = speed;
    }

    calculateCaloriesBurnt(): number {
        // Add validation to ensure properties are set
        if (!this.species || !this.weight || !this.age || !this.sex) {
            console.error('Missing required properties:', {
                species: this.species,
                weight: this.weight,
                age: this.age,
                sex: this.sex,
                speed: this.speed
            });
            return 0;
        }

        const bmr: Record<DogSpecies, number> = {
            'Labrador': 70,
            'German Shepherd': 75,
            'Golden Retriever': 72,
            'French Bulldog': 60,
            'Poodle': 65,
            'Other': 70
        };

        const ageFactor: Record<AgeGroup, number> = {
            'puppy (0-1 year)': 1.3,
            'adult (1-7 years)': 1.2,
            'senior (7+ years)': 1.1
        };

        const sexFactor: Record<Sex, number> = {
            'male': 1.2,
            'female': 1.1
        };

        // Calculate base BMR calories
        const bmrCalories = bmr[this.species] * Math.pow(this.weight, 0.75);

        // Determine activity factor based on speed
        let activityFactor: number;
        if (this.speed < 2) {
            activityFactor = 1.2;
        } else if (this.speed < 4) {
            activityFactor = 1.5;
        } else {
            activityFactor = 1.8;
        }

        // Calculate total calories burnt
        const caloriesBurnt = bmrCalories * ageFactor[this.age] * sexFactor[this.sex] * activityFactor;
        
        // Debug logging
        console.log({
            bmrCalories,
            speciesBMR: bmr[this.species],
            ageFactorValue: ageFactor[this.age],
            sexFactorValue: sexFactor[this.sex],
            activityFactor
        });

        return caloriesBurnt;
    }
}

class HeartRateCalculator {
    private readonly SAMPLE_RATE: number = 25;
    private readonly BUFFER_SIZE: number = 100;
    private readonly PEAK_THRESHOLD: number = 50;
    private lastBeatTime: number = 0;
    private lastIRValue: number = 0;
    private beats: number[] = [];
    private bpm: number = 0;

    // Moving average filter to smooth the signal
    private movingAverage(irValue: number): number {
        const alpha = 0.2;
        const smoothedValue = this.lastIRValue + alpha * (irValue - this.lastIRValue);
        this.lastIRValue = smoothedValue;
        return smoothedValue;
    }

    // Check if current value is a peak
    private isPeak(currentValue: number, previousValue: number, nextValue: number): boolean {
        return (currentValue > previousValue &&
                currentValue > nextValue &&
                currentValue > this.PEAK_THRESHOLD);
    }

    // Calculate BPM from IR value
    calculateBPM(irValue: number): number {
        const currentTime = Date.now();
        const smoothedIR = this.movingAverage(irValue);

        if (this.isPeak(smoothedIR, this.lastIRValue, irValue)) {
            const timeSinceLastBeat = currentTime - this.lastBeatTime;
            
            if (timeSinceLastBeat > 0) {
                const instantBPM = 60000 / timeSinceLastBeat;
                
                if (instantBPM >= 40 && instantBPM <= 220) {
                    this.beats.push(instantBPM);
                    
                    if (this.beats.length > this.BUFFER_SIZE) {
                        this.beats.shift();
                    }
                    
                    if (this.beats.length > 0) {
                        this.bpm = this.beats.reduce((a, b) => a + b) / this.beats.length;
                    }
                }
            }
            this.lastBeatTime = currentTime;
        }

        return Math.round(this.bpm);
    }
}

class StepCounter {
    private readonly THRESHOLD: number = 1.2;
    private readonly MIN_STEP_TIME: number = 250;
    private readonly WINDOW_SIZE: number = 10;
    
    private stepCount: number = 0;
    private lastStepTime: number = 0;
    private accelerationWindow: number[] = [];
    private lastMagnitude: number = 0;
    private isPeak: boolean = false;

    private calculateMagnitude(x: number, y: number, z: number): number {
        return Math.sqrt(x * x + y * y + z * z);
    }

    private movingAverage(magnitude: number): number {
        this.accelerationWindow.push(magnitude);
        
        if (this.accelerationWindow.length > this.WINDOW_SIZE) {
            this.accelerationWindow.shift();
        }

        const sum = this.accelerationWindow.reduce((a, b) => a + b, 0);
        return sum / this.accelerationWindow.length;
    }

    private detectPeak(currentMagnitude: number, threshold: number): boolean {
        const isPeak = currentMagnitude > threshold && 
                      currentMagnitude > this.lastMagnitude;
        this.lastMagnitude = currentMagnitude;
        return isPeak;
    }

    processAccelerometerData(x: number, y: number, z: number): number {
        const currentTime = Date.now();
        const magnitude = this.calculateMagnitude(x, y, z);
        const smoothedMagnitude = this.movingAverage(magnitude);
        const currentIsPeak = this.detectPeak(smoothedMagnitude, this.THRESHOLD);
        
        if (currentIsPeak && !this.isPeak) {
            const timeSinceLastStep = currentTime - this.lastStepTime;
            
            if (timeSinceLastStep > this.MIN_STEP_TIME) {
                this.stepCount++;
                this.lastStepTime = currentTime;
            }
        }
        
        this.isPeak = currentIsPeak;
        return this.stepCount;
    }

    getStepCount(): number {
        return this.stepCount;
    }

    resetStepCount(): void {
        this.stepCount = 0;
        this.lastStepTime = 0;
        this.accelerationWindow = [];
        this.lastMagnitude = 0;
        this.isPeak = false;
    }
}

interface ResponseData {
    bpm: number;
    caloriesBurnt: number;
    steps: number;
}

app.post('/sensor_data', (req: Request<{}, {}, SensorData>, res: Response<ResponseData>) => {
    const sensorData = req.body;

    console.log('Received sensor data:', sensorData);

    const myDog = new Dog(sensorData.dog_breed, sensorData.weight, sensorData.age, sensorData.sex, sensorData.speed);
    const heartRateCalculator = new HeartRateCalculator();
    const stepCounter = new StepCounter();

    const caloriesBurnt = myDog.calculateCaloriesBurnt();
    const bpm = heartRateCalculator.calculateBPM(sensorData.ir_value);
    const steps = stepCounter.processAccelerometerData(sensorData.x, sensorData.y, sensorData.z);

    console.log(`Current BPM: ${bpm}`);
    console.log(`The calories burnt by my ${sensorData.dog_breed} is ${caloriesBurnt.toFixed(2)} calories.`);    
    console.log(`Current step count: ${steps}`);
    
    res.json({
        bpm,
        caloriesBurnt,
        steps
    });
});

app.listen(port, () => console.log(`Server running on port ${port}`));