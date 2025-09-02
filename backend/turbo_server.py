from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date, timedelta
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client['turbo_service_db']

# Create the main app
app = FastAPI(title="Turbó Szerviz Kezelő API")
api_router = APIRouter(prefix="/api")


# Enums
class WorkStatus(str, Enum):
    DRAFT = "DRAFT"                 # Piszkozat
    RECEIVED = "RECEIVED"           # Beérkezett
    IN_PROGRESS = "IN_PROGRESS"     # Vizsgálat alatt
    QUOTED = "QUOTED"               # Árajánlat készült
    ACCEPTED = "ACCEPTED"           # Elfogadva
    REJECTED = "REJECTED"           # Elutasítva
    WORKING = "WORKING"             # Javítás alatt
    READY = "READY"                 # Kész
    DELIVERED = "DELIVERED"         # Átvett
    FINALIZED = "FINALIZED"         # Véglegesítve

class DocumentType(str, Enum):
    IPOS = "IPOS"
    FACT_CHIT = "FACT_CHIT"
    FACT = "FACT"
    BON_F = "BON_F"

class NoteType(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


# Car Database Models
class CarMake(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                       # BMW, Audi, Mercedes
    logo_url: Optional[str] = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CarMakeCreate(BaseModel):
    name: str
    logo_url: Optional[str] = ""

class CarModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    make_id: str                    # Hivatkozás CarMake-re
    name: str                       # X5, A4, C-Class
    engine_codes: List[str] = []    # Lehetséges motorkódok
    common_turbos: List[str] = []   # Gyakori turbó kódok ehhez a modellhez
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CarModelCreate(BaseModel):
    make_id: str
    name: str
    engine_codes: List[str] = []
    common_turbos: List[str] = []


# Notes Models
class TurboNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    turbo_code: str                 # Turbó kód amire vonatkozik
    note_type: NoteType = NoteType.INFO
    title: str                      # Megjegyzés címe
    description: str                # Részletes leírás
    created_by: str = "System"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class TurboNoteCreate(BaseModel):
    turbo_code: str
    note_type: NoteType = NoteType.INFO
    title: str
    description: str

class CarNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    car_make: str                   # BMW, Audi
    car_model: str                  # X5, A4
    engine_code: Optional[str] = ""
    note_type: NoteType = NoteType.INFO
    title: str
    description: str
    created_by: str = "System"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class CarNoteCreate(BaseModel):
    car_make: str
    car_model: str
    engine_code: Optional[str] = ""
    note_type: NoteType = NoteType.INFO
    title: str
    description: str


# Client Models
class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    company_name: Optional[str] = ""
    tax_number: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ClientCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    company_name: Optional[str] = ""
    tax_number: Optional[str] = ""
    notes: Optional[str] = ""

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    tax_number: Optional[str] = None
    notes: Optional[str] = None


# Work Process Models
class WorkProcess(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                       # pl. "Szétszerelés", "Tisztítás"
    category: str                   # pl. "Diagnosis", "Cleaning"
    estimated_time: int = 0         # perc
    base_price: float = 0.0         # LEI
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WorkProcessCreate(BaseModel):
    name: str
    category: str
    estimated_time: int = 0
    base_price: float = 0.0

class WorkOrderProcess(BaseModel):
    process_id: str
    process_name: str
    category: str
    estimated_time: int
    price: float
    selected: bool = False
    notes: str = ""


# Turbo Parts Models
class TurboPart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str                   # C.H.R.A, GEO, ACT, SET.GAR
    part_code: str
    supplier: str
    price: float = 0.0
    in_stock: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TurboPartCreate(BaseModel):
    category: str
    part_code: str
    supplier: str
    price: float = 0.0
    in_stock: bool = True

class WorkOrderPart(BaseModel):
    part_id: str
    part_code: str
    category: str
    supplier: str
    price: float
    selected: bool = False


# Vehicle Models
class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    make: Optional[str] = ""
    model: Optional[str] = ""
    year: Optional[int] = None
    license_plate: Optional[str] = ""
    vin: Optional[str] = ""
    engine_code: Optional[str] = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VehicleCreate(BaseModel):
    client_id: str
    make: Optional[str] = ""
    model: Optional[str] = ""
    year: Optional[int] = None
    license_plate: Optional[str] = ""
    vin: Optional[str] = ""
    engine_code: Optional[str] = ""


# Work Order Models
class WorkOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    work_number: str                # NR (43005)
    work_sequence: int = 0          # Sorszám (1, 2, 3, ...)
    client_id: str
    vehicle_id: Optional[str] = None
    turbo_code: str                 # 5490-970-0071
    
    # Car details (stored directly in work order)
    car_make: str = ""
    car_model: str = ""
    car_year: Optional[int] = None
    engine_code: Optional[str] = ""
    general_notes: str = ""
    
    # Received date
    received_date: date = Field(default_factory=date.today)
    
    # Parts and processes selection
    parts: List[WorkOrderPart] = []
    processes: List[WorkOrderProcess] = []
    
    # Status checkboxes
    status_passed: bool = False     # OK (PASSED)
    status_refused: bool = False    # REFUZAT
    
    # Prices
    cleaning_price: float = 170.0   # Curatat
    reconditioning_price: float = 170.0 # Recond
    turbo_price: float = 240.0      # Turbo
    
    # Workflow
    status: WorkStatus = WorkStatus.DRAFT
    is_finalized: bool = False      # Véglegesítve van-e
    quote_sent: bool = False        # OFERTAT
    quote_accepted: bool = False    # ACCEPT
    estimated_completion: Optional[date] = None # TERMEN ESTIMATIV
    
    # Documents
    documents_generated: List[DocumentType] = []
    finalized: bool = False
    client_notified: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    finalized_at: Optional[datetime] = None

class WorkOrderCreate(BaseModel):
    client_id: str
    turbo_code: str
    car_make: str = ""
    car_model: str = ""
    car_year: Optional[int] = None
    engine_code: Optional[str] = ""
    general_notes: str = ""

class WorkOrderUpdate(BaseModel):
    work_sequence: Optional[int] = None
    turbo_code: Optional[str] = None
    car_make: Optional[str] = None
    car_model: Optional[str] = None
    car_year: Optional[int] = None
    engine_code: Optional[str] = None
    general_notes: Optional[str] = None
    parts: Optional[List[WorkOrderPart]] = None
    processes: Optional[List[WorkOrderProcess]] = None
    status_passed: Optional[bool] = None
    status_refused: Optional[bool] = None
    cleaning_price: Optional[float] = None
    reconditioning_price: Optional[float] = None
    turbo_price: Optional[float] = None
    status: Optional[WorkStatus] = None
    is_finalized: Optional[bool] = None
    quote_sent: Optional[bool] = None
    quote_accepted: Optional[bool] = None
    estimated_completion: Optional[date] = None
    finalized: Optional[bool] = None
    client_notified: Optional[bool] = None
    finalized_at: Optional[datetime] = None


class WorkOrderWithDetails(BaseModel):
    id: str
    work_number: str
    client_name: str
    client_phone: str
    car_info: str
    turbo_code: str
    received_date: date
    status: WorkStatus
    total_amount: float
    estimated_completion: Optional[date]
    has_turbo_warning: bool = False
    has_car_warning: bool = False
    created_at: datetime


# Helper function to generate work number
async def generate_work_number() -> str:
    """Generate next work number based on existing entries"""
    pipeline = [
        {"$match": {"work_number": {"$regex": "^[0-9]+$"}}},
        {"$addFields": {"num": {"$toInt": "$work_number"}}},
        {"$sort": {"num": -1}},
        {"$limit": 1}
    ]
    
    result = await db.work_orders.aggregate(pipeline).to_list(1)
    
    if result:
        next_num = result[0]["num"] + 1
    else:
        next_num = 40000  # Starting number
    
    return str(next_num)

async def get_next_sequence_number():
    """Get next sequence number (starting from 1)"""
    # Find the highest existing sequence number
    result = await db.work_orders.find().sort("work_sequence", -1).limit(1).to_list(1)
    
    if result:
        next_sequence = result[0].get("work_sequence", 0) + 1
    else:
        next_sequence = 1  # Starting from 1
    
    return next_sequence

async def recalculate_sequence_numbers():
    """Recalculate sequence numbers after deletion"""
    # Get all work orders ordered by creation date
    work_orders = await db.work_orders.find().sort("created_at", 1).to_list(1000)
    
    # Update sequence numbers sequentially
    for index, work_order in enumerate(work_orders, 1):
        new_work_number = f"{index:05d}"  # 00001, 00002, etc.
        
        await db.work_orders.update_one(
            {"id": work_order["id"]},
            {
                "$set": {
                    "work_sequence": index,
                    "work_number": new_work_number,
                    "updated_at": datetime.utcnow()
                }
            }
        )

async def generate_next_work_number():
    """Generate next work order number (legacy function)"""
    # Find the highest existing work number
    pipeline = [
        {"$match": {"work_number": {"$regex": "^[0-9]+$"}}},
        {"$addFields": {"work_number_int": {"$toInt": "$work_number"}}},
        {"$sort": {"work_number_int": -1}},
        {"$limit": 1}
    ]
    
    result = await db.work_orders.aggregate(pipeline).to_list(1)
    
    if result:
        next_number = result[0]["work_number_int"] + 1
    else:
        next_number = 43005  # Starting number
    
    return str(next_number)

# API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Turbó Szerviz Kezelő API működik"}


# Car Makes endpoints
@api_router.post("/car-makes", response_model=CarMake)
async def create_car_make(car_make: CarMakeCreate):
    existing = await db.car_makes.find_one({"name": car_make.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ez az autó márka már létezik")
    
    car_make_obj = CarMake(**car_make.dict())
    await db.car_makes.insert_one(car_make_obj.dict())
    return car_make_obj

@api_router.get("/car-makes", response_model=List[CarMake])
async def get_car_makes():
    makes = await db.car_makes.find().sort("name", 1).to_list(1000)
    return [CarMake(**make) for make in makes]

@api_router.get("/car-models/{make_id}", response_model=List[CarModel])
async def get_car_models(make_id: str):
    models = await db.car_models.find({"make_id": make_id}).sort("name", 1).to_list(1000)
    return [CarModel(**model) for model in models]

@api_router.post("/car-models", response_model=CarModel)
async def create_car_model(car_model: CarModelCreate):
    existing = await db.car_models.find_one({"make_id": car_model.make_id, "name": car_model.name})
    if existing:
        raise HTTPException(status_code=400, detail="Ez a modell már létezik ehhez a márkához")
    
    car_model_obj = CarModel(**car_model.dict())
    await db.car_models.insert_one(car_model_obj.dict())
    return car_model_obj


# Notes endpoints
@api_router.post("/turbo-notes", response_model=TurboNote)
async def create_turbo_note(note: TurboNoteCreate):
    note_obj = TurboNote(**note.dict())
    await db.turbo_notes.insert_one(note_obj.dict())
    return note_obj

@api_router.get("/turbo-notes/{turbo_code}", response_model=List[TurboNote])
async def get_turbo_notes(turbo_code: str):
    notes = await db.turbo_notes.find({"turbo_code": turbo_code, "active": True}).to_list(1000)
    return [TurboNote(**note) for note in notes]

@api_router.post("/car-notes", response_model=CarNote)
async def create_car_note(note: CarNoteCreate):
    note_obj = CarNote(**note.dict())
    await db.car_notes.insert_one(note_obj.dict())
    return note_obj

@api_router.get("/car-notes/{car_make}/{car_model}", response_model=List[CarNote])
async def get_car_notes(car_make: str, car_model: str):
    notes = await db.car_notes.find({
        "car_make": car_make, 
        "car_model": car_model, 
        "active": True
    }).to_list(1000)
    return [CarNote(**note) for note in notes]


# Work Process endpoints
@api_router.post("/work-processes", response_model=WorkProcess)
async def create_work_process(process: WorkProcessCreate):
    process_obj = WorkProcess(**process.dict())
    await db.work_processes.insert_one(process_obj.dict())
    return process_obj

@api_router.get("/work-processes", response_model=List[WorkProcess])
async def get_work_processes():
    processes = await db.work_processes.find({"active": True}).sort("category", 1).to_list(1000)
    return [WorkProcess(**process) for process in processes]

@api_router.put("/work-processes/{process_id}", response_model=WorkProcess)
async def update_work_process(process_id: str, process_update: WorkProcessCreate):
    await db.work_processes.update_one(
        {"id": process_id}, 
        {"$set": process_update.dict()}
    )
    updated = await db.work_processes.find_one({"id": process_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Munkafolyamat nem található")
    return WorkProcess(**updated)

@api_router.delete("/work-processes/{process_id}")
async def delete_work_process(process_id: str):
    result = await db.work_processes.update_one(
        {"id": process_id}, 
        {"$set": {"active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Munkafolyamat nem található")
    return {"message": "Munkafolyamat törölve"}


# Turbo Parts endpoints
@api_router.post("/turbo-parts", response_model=TurboPart)
async def create_turbo_part(part: TurboPartCreate):
    existing = await db.turbo_parts.find_one({"part_code": part.part_code})
    if existing:
        raise HTTPException(status_code=400, detail="Ez az alkatrész kód már létezik")
    
    part_obj = TurboPart(**part.dict())
    await db.turbo_parts.insert_one(part_obj.dict())
    return part_obj

@api_router.get("/turbo-parts", response_model=List[TurboPart])
async def get_turbo_parts(category: Optional[str] = None):
    query = {"category": category} if category else {}
    parts = await db.turbo_parts.find(query).sort("category", 1).to_list(1000)
    return [TurboPart(**part) for part in parts]

@api_router.put("/turbo-parts/{part_id}", response_model=TurboPart)
async def update_turbo_part(part_id: str, part_update: TurboPartCreate):
    await db.turbo_parts.update_one(
        {"id": part_id}, 
        {"$set": part_update.dict()}
    )
    updated = await db.turbo_parts.find_one({"id": part_id})
    if not updated:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    return TurboPart(**updated)

@api_router.delete("/turbo-parts/{part_id}")
async def delete_turbo_part(part_id: str):
    result = await db.turbo_parts.delete_one({"id": part_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    return {"message": "Alkatrész törölve"}


# Clients endpoints
@api_router.post("/clients", response_model=Client)
async def create_client(client: ClientCreate):
    # Check if client already exists (by phone)
    existing = await db.clients.find_one({"phone": client.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Ügyfél ezzel a telefonszámmal már létezik")
    
    client_obj = Client(**client.dict())
    await db.clients.insert_one(client_obj.dict())
    return client_obj

@api_router.get("/clients", response_model=List[Client])
async def get_clients(search: Optional[str] = None):
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
                {"company_name": {"$regex": search, "$options": "i"}}
            ]
        }
    else:
        query = {}
    
    clients = await db.clients.find(query).sort("name", 1).to_list(1000)
    return [Client(**client) for client in clients]

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    return Client(**client)

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, client_update: ClientUpdate):
    existing = await db.clients.find_one({"id": client_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    
    update_data = {k: v for k, v in client_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.clients.update_one({"id": client_id}, {"$set": update_data})
    
    updated = await db.clients.find_one({"id": client_id})
    return Client(**updated)


# Vehicles endpoints
@api_router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate):
    client = await db.clients.find_one({"id": vehicle.client_id})
    if not client:
        raise HTTPException(status_code=400, detail="Ügyfél nem található")
    
    vehicle_obj = Vehicle(**vehicle.dict())
    await db.vehicles.insert_one(vehicle_obj.dict())
    return vehicle_obj

@api_router.get("/vehicles", response_model=List[Vehicle])
async def get_vehicles(client_id: Optional[str] = None):
    query = {"client_id": client_id} if client_id else {}
    vehicles = await db.vehicles.find(query).to_list(1000)
    return [Vehicle(**vehicle) for vehicle in vehicles]


# Work Orders endpoints
@api_router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(work_order: WorkOrderCreate):
    """Create a new work order"""
    client = await db.clients.find_one({"id": work_order.client_id})
    if not client:
        raise HTTPException(status_code=400, detail="Ügyfél nem található")
    
    # Get next sequence number
    next_sequence = await get_next_sequence_number()
    
    # Generate work number based on sequence
    work_number = f"{next_sequence:05d}"  # 00001, 00002, stb.
    
    work_order_obj = WorkOrder(
        **work_order.dict(), 
        work_number=work_number,
        work_sequence=next_sequence,
        status=WorkStatus.DRAFT
    )
    await db.work_orders.insert_one(work_order_obj.dict())
    
    return work_order_obj

@api_router.get("/work-orders", response_model=List[WorkOrderWithDetails])
async def get_work_orders(
    status: Optional[WorkStatus] = None,
    client_id: Optional[str] = None,
    search: Optional[str] = None
):
    pipeline = [
        {
            "$lookup": {
                "from": "clients",
                "localField": "client_id",
                "foreignField": "id",
                "as": "client"
            }
        },
        {"$unwind": "$client"},
        {
            "$addFields": {
                "car_info": {
                    "$concat": [
                        "$car_make",
                        " ",
                        "$car_model",
                        {
                            "$cond": {
                                "if": {"$ne": ["$car_year", None]},
                                "then": {
                                    "$concat": [" (", {"$toString": "$car_year"}, ")"]
                                },
                                "else": ""
                            }
                        }
                    ]
                },
                "total_amount": {
                    "$add": ["$cleaning_price", "$reconditioning_price", "$turbo_price"]
                }
            }
        }
    ]
    
    # Check for warnings
    pipeline.append({
        "$lookup": {
            "from": "turbo_notes",
            "localField": "turbo_code",
            "foreignField": "turbo_code",
            "as": "turbo_warnings"
        }
    })
    
    pipeline.append({
        "$lookup": {
            "from": "car_notes",
            "let": {"make": "$car_make", "model": "$car_model"},
            "pipeline": [
                {
                    "$match": {
                        "$expr": {
                            "$and": [
                                {"$eq": ["$car_make", "$$make"]},
                                {"$eq": ["$car_model", "$$model"]}
                            ]
                        }
                    }
                }
            ],
            "as": "car_warnings"
        }
    })
    
    pipeline.append({
        "$addFields": {
            "has_turbo_warning": {"$gt": [{"$size": "$turbo_warnings"}, 0]},
            "has_car_warning": {"$gt": [{"$size": "$car_warnings"}, 0]}
        }
    })
    
    # Add filters
    match_conditions = {}
    if status:
        match_conditions["status"] = status
    if client_id:
        match_conditions["client_id"] = client_id
    if search:
        match_conditions["$or"] = [
            {"work_number": {"$regex": search, "$options": "i"}},
            {"turbo_code": {"$regex": search, "$options": "i"}},
            {"client.name": {"$regex": search, "$options": "i"}},
            {"car_make": {"$regex": search, "$options": "i"}},
            {"car_model": {"$regex": search, "$options": "i"}}
        ]
    
    if match_conditions:
        pipeline.append({"$match": match_conditions})
    
    pipeline.append({"$sort": {"created_at": -1}})
    
    work_orders = await db.work_orders.aggregate(pipeline).to_list(1000)
    
    result = []
    for wo in work_orders:
        result.append(WorkOrderWithDetails(
            id=wo["id"],
            work_number=wo["work_number"],
            client_name=wo["client"]["name"],
            client_phone=wo["client"]["phone"],
            car_info=wo.get("car_info", "").strip(),
            turbo_code=wo["turbo_code"],
            received_date=wo["received_date"],
            status=wo["status"],
            total_amount=wo["total_amount"],
            estimated_completion=wo.get("estimated_completion"),
            has_turbo_warning=wo.get("has_turbo_warning", False),
            has_car_warning=wo.get("has_car_warning", False),
            created_at=wo["created_at"]
        ))
    
    return result

@api_router.get("/work-orders/{work_order_id}", response_model=WorkOrder)
async def get_work_order(work_order_id: str):
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    return WorkOrder(**work_order)

@api_router.put("/work-orders/{work_order_id}", response_model=WorkOrder)
async def update_work_order(work_order_id: str, work_order_update: WorkOrderUpdate):
    existing = await db.work_orders.find_one({"id": work_order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    update_data = {k: v for k, v in work_order_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.work_orders.update_one({"id": work_order_id}, {"$set": update_data})
    
    updated = await db.work_orders.find_one({"id": work_order_id})
    return WorkOrder(**updated)

@api_router.delete("/work-orders/{work_order_id}")
async def delete_work_order(work_order_id: str):
    """Delete work order (only if not finalized)"""
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    # Check if work order is finalized
    if work_order.get("is_finalized", False):
        raise HTTPException(status_code=400, detail="Véglegesített munkalapot nem lehet törölni!")
    
    # Delete the work order
    result = await db.work_orders.delete_one({"id": work_order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    # Recalculate sequence numbers for remaining work orders
    await recalculate_sequence_numbers()
    
    return {"message": "Munkalap törölve és számozás frissítve"}

@api_router.post("/work-orders/{work_order_id}/finalize")
async def finalize_work_order(work_order_id: str):
    """Finalize work order (cannot be deleted after this)"""
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    if work_order.get("is_finalized", False):
        raise HTTPException(status_code=400, detail="A munkalap már véglegesítve van")
    
    # Update work order to finalized
    await db.work_orders.update_one(
        {"id": work_order_id},
        {
            "$set": {
                "is_finalized": True,
                "finalized_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "status": WorkStatus.RECEIVED  # Change from DRAFT to RECEIVED
            }
        }
    )
    
    updated = await db.work_orders.find_one({"id": work_order_id})
    return WorkOrder(**updated)

@api_router.post("/work-orders/{work_order_id}/unfinalize")
async def unfinalize_work_order(work_order_id: str):
    """Unfinalize work order (for admin purposes)"""
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    # Update work order to draft
    await db.work_orders.update_one(
        {"id": work_order_id},
        {
            "$set": {
                "is_finalized": False,
                "finalized_at": None,
                "updated_at": datetime.utcnow(),
                "status": WorkStatus.DRAFT
            }
        }
    )
    
    updated = await db.work_orders.find_one({"id": work_order_id})
    return WorkOrder(**updated)


# Initialize default data
@api_router.post("/initialize-data")
async def initialize_data():
    # Initialize car makes
    car_makes = [
        "BMW", "Audi", "Mercedes-Benz", "Volkswagen", "Ford", 
        "Peugeot", "Renault", "Opel", "Citroen", "Skoda"
    ]
    
    for make_name in car_makes:
        existing = await db.car_makes.find_one({"name": make_name})
        if not existing:
            make_obj = CarMake(name=make_name)
            await db.car_makes.insert_one(make_obj.dict())
    
    # Initialize work processes
    default_processes = [
        {"name": "Szétszerelés", "category": "Disassembly", "estimated_time": 60, "base_price": 80.0},
        {"name": "Tisztítás", "category": "Cleaning", "estimated_time": 90, "base_price": 120.0},
        {"name": "Diagnosztika", "category": "Diagnosis", "estimated_time": 45, "base_price": 60.0},
        {"name": "Alkatrész csere", "category": "Repair", "estimated_time": 120, "base_price": 150.0},
        {"name": "Összeszerelés", "category": "Assembly", "estimated_time": 90, "base_price": 100.0},
        {"name": "Tesztelés", "category": "Testing", "estimated_time": 30, "base_price": 40.0},
    ]
    
    for process_data in default_processes:
        existing = await db.work_processes.find_one({"name": process_data["name"]})
        if not existing:
            process_obj = WorkProcess(**process_data)
            await db.work_processes.insert_one(process_obj.dict())
    
    # Initialize turbo parts
    default_parts = [
        {"category": "C.H.R.A", "part_code": "1303-090-400", "supplier": "Melett", "price": 450.0},
        {"category": "C.H.R.A", "part_code": "1303-090-401", "supplier": "Vallion", "price": 420.0},
        {"category": "GEO", "part_code": "5306-016-071-0001", "supplier": "Melett", "price": 85.0},
        {"category": "GEO", "part_code": "5306-016-072-0001", "supplier": "Vallion", "price": 80.0},
        {"category": "ACT", "part_code": "2061-016-006", "supplier": "Melett", "price": 120.0},
        {"category": "ACT", "part_code": "2061-016-007", "supplier": "Vallion", "price": 115.0},
        {"category": "SET.GAR", "part_code": "K7-110690", "supplier": "Melett", "price": 25.0},
        {"category": "SET.GAR", "part_code": "K7-110691", "supplier": "Vallion", "price": 22.0},
    ]
    
    for part_data in default_parts:
        existing = await db.turbo_parts.find_one({"part_code": part_data["part_code"]})
        if not existing:
            part_obj = TurboPart(**part_data)
            await db.turbo_parts.insert_one(part_obj.dict())
    
    return {"message": "Alapadatok inicializálva"}


# Printing endpoints
@api_router.get("/work-orders/{work_order_id}/pdf")
async def generate_work_order_pdf(work_order_id: str):
    from weasyprint import HTML
    from jinja2 import Template
    from fastapi.responses import Response
    
    # Get work order with client details
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    client = await db.clients.find_one({"id": work_order["client_id"]})
    if not client:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    
    # PDF Template for work order
    pdf_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .company-info { text-align: center; margin-bottom: 20px; }
            .work-number { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px; }
            .section { margin-bottom: 20px; }
            .section h3 { background-color: #f5f5f5; padding: 8px; margin: 0 0 10px 0; border-left: 4px solid #333; }
            .grid { display: flex; gap: 20px; }
            .column { flex: 1; }
            .info-row { margin: 5px 0; }
            .label { font-weight: bold; }
            .parts-table, .process-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .parts-table th, .parts-table td, .process-table th, .process-table td { 
                border: 1px solid #ddd; padding: 8px; text-align: left; 
            }
            .parts-table th, .process-table th { background-color: #f5f5f5; font-weight: bold; }
            .status { font-weight: bold; padding: 5px 10px; border-radius: 3px; color: white; }
            .status.RECEIVED { background-color: #3b82f6; }
            .status.IN_PROGRESS { background-color: #f59e0b; }
            .status.QUOTED { background-color: #8b5cf6; }
            .status.ACCEPTED { background-color: #10b981; }
            .status.WORKING { background-color: #f97316; }
            .status.READY { background-color: #14b8a6; }
            .status.DELIVERED { background-color: #6b7280; }
            .pricing { border: 2px solid #333; padding: 15px; background-color: #f9f9f9; }
            .total { font-size: 1.3em; font-weight: bold; color: #333; }
            .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <!-- Work Number Box (Top Left) -->
        <div style="position: absolute; top: 10mm; left: 10mm; z-index: 100;">
            <div style="
                background: #3B82F6;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                border: 2px solid #1E40AF;
                margin-bottom: 4px;
            ">
                MUNKA-#{{ work_order.work_number }}
            </div>
            <div style="
                background: #10B981;
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                border: 2px solid #047857;
            ">
                📅 {{ work_order.created_at.strftime('%Y.%m.%d') }}
            </div>
        </div>

        <div class="header">
            <div class="company-info">
                <h1>🔧 TURBÓ SZERVIZ</h1>
                <p>Turbófeltöltő javítás és karbantartás</p>
            </div>
            <div class="work-number">MUNKALAP #{{ work_order.work_number }}</div>
        </div>

        <div class="grid">
            <div class="column">
                <div class="section">
                    <h3>👤 Ügyfél adatok</h3>
                    <div class="info-row">
                        <span class="label">Név:</span> {{ client.name }}
                    </div>
                    <div class="info-row">
                        <span class="label">Telefon:</span> {{ client.phone }}
                    </div>
                    {% if client.address %}
                    <div class="info-row">
                        <span class="label">Cím:</span> {{ client.address }}
                    </div>
                    {% endif %}
                    {% if client.company_name %}
                    <div class="info-row">
                        <span class="label">Cégnév:</span> {{ client.company_name }}
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <div class="column">
                <div class="section">
                    <h3>🚗 Jármű adatok</h3>
                    <div class="info-row">
                        <span class="label">Márka:</span> {{ work_order.car_make }}
                    </div>
                    <div class="info-row">
                        <span class="label">Típus:</span> {{ work_order.car_model }}
                    </div>
                    {% if work_order.car_year %}
                    <div class="info-row">
                        <span class="label">Évjárat:</span> {{ work_order.car_year }}
                    </div>
                    {% endif %}
                    {% if work_order.engine_code %}
                    <div class="info-row">
                        <span class="label">Motorkód:</span> {{ work_order.engine_code }}
                    </div>
                    {% endif %}
                </div>
            </div>
        </div>

        <div class="section">
            <h3>🔧 Turbó információk</h3>
            <div class="info-row">
                <span class="label">Turbó kód:</span> {{ work_order.turbo_code }}
            </div>
            <div class="info-row">
                <span class="label">Beérkezés dátuma:</span> {{ work_order.received_date }}
            </div>
            {% if work_order.general_notes %}
            <div class="info-row">
                <span class="label">Megjegyzések:</span> {{ work_order.general_notes }}
            </div>
            {% endif %}
        </div>

        {% if work_order.parts %}
        <div class="section">
            <h3>🔩 Kiválasztott alkatrészek</h3>
            <table class="parts-table">
                <thead>
                    <tr>
                        <th>Alkatrész kód</th>
                        <th>Kategória</th>
                        <th>Szállító</th>
                        <th>Ár (LEI)</th>
                        <th>Kiválasztva</th>
                    </tr>
                </thead>
                <tbody>
                    {% for part in work_order.parts %}
                    <tr>
                        <td>{{ part.part_code }}</td>
                        <td>{{ part.category }}</td>
                        <td>{{ part.supplier }}</td>
                        <td>{{ "{:,.2f}".format(part.price) }}</td>
                        <td>{{ "✓" if part.selected else "✗" }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}

        {% if work_order.processes %}
        <div class="section">
            <h3>⚙️ Munkafolyamatok</h3>
            <table class="process-table">
                <thead>
                    <tr>
                        <th>Folyamat</th>
                        <th>Kategória</th>
                        <th>Becsült idő (perc)</th>
                        <th>Ár (LEI)</th>
                        <th>Kiválasztva</th>
                    </tr>
                </thead>
                <tbody>
                    {% for process in work_order.processes %}
                    <tr>
                        <td>{{ process.process_name }}</td>
                        <td>{{ process.category }}</td>
                        <td>{{ process.estimated_time }}</td>
                        <td>{{ "{:,.2f}".format(process.price) }}</td>
                        <td>{{ "✓" if process.selected else "✗" }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        {% endif %}

        <div class="grid">
            <div class="column">
                <div class="section">
                    <h3>📊 Státusz információk</h3>
                    <div class="status {{ work_order.status }}">{{ status_text }}</div>
                    <div class="info-row" style="margin-top: 10px;">
                        <span class="label">Árajánlat küldve:</span> {{ "Igen" if work_order.quote_sent else "Nem" }}
                    </div>
                    <div class="info-row">
                        <span class="label">Árajánlat elfogadva:</span> {{ "Igen" if work_order.quote_accepted else "Nem" }}
                    </div>
                    {% if work_order.estimated_completion %}
                    <div class="info-row">
                        <span class="label">Becsült készre kerülés:</span> {{ work_order.estimated_completion }}
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <div class="column">
                <div class="section pricing">
                    <h3>💰 Árazás</h3>
                    <div class="info-row">
                        <span class="label">Tisztítás:</span> {{ "{:,.2f}".format(work_order.cleaning_price) }} LEI
                    </div>
                    <div class="info-row">
                        <span class="label">Felújítás:</span> {{ "{:,.2f}".format(work_order.reconditioning_price) }} LEI
                    </div>
                    <div class="info-row">
                        <span class="label">Turbó:</span> {{ "{:,.2f}".format(work_order.turbo_price) }} LEI
                    </div>
                    <hr style="margin: 10px 0;">
                    <div class="info-row total">
                        <span class="label">Összesen:</span> {{ "{:,.2f}".format(total_amount) }} LEI
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Munkalap generálva: {{ now.strftime("%Y-%m-%d %H:%M:%S") }}</p>
            <p>🔧 Turbó Szerviz Kezelő Rendszer</p>
        </div>
    </body>
    </html>
    """
    
    # Status translations
    status_translations = {
        'RECEIVED': 'Beérkezett',
        'IN_PROGRESS': 'Vizsgálat alatt',
        'QUOTED': 'Árajánlat készült',
        'ACCEPTED': 'Elfogadva',
        'REJECTED': 'Elutasítva',
        'WORKING': 'Javítás alatt',
        'READY': 'Kész',
        'DELIVERED': 'Átvett'
    }
    
    # Add new status translations
    status_translations['DRAFT'] = 'Piszkozat'
    status_translations['FINALIZED'] = 'Véglegesítve'
    
    # Calculate total amount
    total_amount = work_order.get("cleaning_price", 0) + work_order.get("reconditioning_price", 0) + work_order.get("turbo_price", 0)
    
    # Render template
    template = Template(pdf_template)
    html_content = template.render(
        work_order=work_order,
        client=client,
        status_text=status_translations.get(work_order["status"], work_order["status"]),
        total_amount=total_amount,
        now=datetime.utcnow()
    )
    
    # Generate PDF
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=munkalap_{work_order['work_number']}.pdf"}
    )

@api_router.get("/work-orders/{work_order_id}/html")
async def generate_work_order_html(work_order_id: str):
    """Generate HTML print version of work order"""
    from jinja2 import Template
    from fastapi.responses import HTMLResponse
    
    # Get work order with client details
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    client = await db.clients.find_one({"id": work_order["client_id"]})
    if not client:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    
    # HTML Template for work order
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Munkalap #{{ work_order.work_number }}</title>
        <style>
            @media print {
                @page { margin: 20mm; }
                body { margin: 0; }
                .no-print { display: none !important; }
            }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 20px; 
                line-height: 1.6; 
                color: #333;
            }
            .header { 
                text-align: center; 
                border-bottom: 3px solid #3B82F6; 
                padding-bottom: 20px; 
                margin-bottom: 30px; 
            }
            .company-info { 
                text-align: center; 
                margin-bottom: 20px; 
            }
            .company-info h1 { 
                color: #3B82F6; 
                margin: 0; 
                font-size: 2.5em; 
            }
            .work-number { 
                font-size: 28px; 
                font-weight: bold; 
                color: #1F2937; 
                margin: 15px 0; 
            }
            .section { 
                margin-bottom: 25px; 
                background: #F9FAFB; 
                border-radius: 8px; 
                padding: 20px; 
            }
            .section h3 { 
                background: linear-gradient(135deg, #3B82F6, #1D4ED8); 
                color: white; 
                padding: 10px 15px; 
                margin: -20px -20px 15px -20px; 
                border-radius: 8px 8px 0 0; 
                font-size: 1.1em;
            }
            .grid { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 30px; 
                margin-bottom: 20px; 
            }
            .column { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            }
            .info-row { 
                margin: 8px 0; 
                display: flex; 
                justify-content: space-between; 
            }
            .label { 
                font-weight: 600; 
                color: #374151; 
                min-width: 120px; 
            }
            .value { 
                color: #1F2937; 
                font-weight: 500; 
            }
            .parts-table, .process-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px; 
                background: white; 
                border-radius: 8px; 
                overflow: hidden; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
            }
            .parts-table th, .parts-table td, .process-table th, .process-table td { 
                border: 1px solid #E5E7EB; 
                padding: 12px; 
                text-align: left; 
            }
            .parts-table th, .process-table th { 
                background: #F3F4F6; 
                font-weight: 600; 
                color: #374151; 
            }
            .status { 
                display: inline-block; 
                font-weight: bold; 
                padding: 8px 16px; 
                border-radius: 20px; 
                color: white; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
            }
            .status.RECEIVED { background: linear-gradient(135deg, #3B82F6, #1D4ED8); }
            .status.IN_PROGRESS { background: linear-gradient(135deg, #F59E0B, #D97706); }
            .status.QUOTED { background: linear-gradient(135deg, #8B5CF6, #7C3AED); }
            .status.ACCEPTED { background: linear-gradient(135deg, #10B981, #059669); }
            .status.WORKING { background: linear-gradient(135deg, #F97316, #EA580C); }
            .status.READY { background: linear-gradient(135deg, #14B8A6, #0D9488); }
            .status.DELIVERED { background: linear-gradient(135deg, #6B7280, #4B5563); }
            .pricing { 
                border: 2px solid #3B82F6; 
                background: linear-gradient(135deg, #EBF4FF, #DBEAFE); 
                padding: 20px; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            }
            .total { 
                font-size: 1.4em; 
                font-weight: bold; 
                color: #1D4ED8; 
                background: white; 
                padding: 10px; 
                border-radius: 6px; 
                text-align: center; 
                margin-top: 10px; 
            }
            .footer { 
                text-align: center; 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 2px solid #E5E7EB; 
                color: #6B7280; 
                font-size: 0.9em; 
            }
            .print-btn {
                background: #10B981;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin: 20px auto;
                display: block;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .print-btn:hover {
                background: #059669;
            }
            @media (max-width: 768px) {
                .grid { grid-template-columns: 1fr; }
                body { margin: 10px; }
                .section { padding: 15px; }
            }
        </style>
    </head>
    <body>
        <button onclick="window.print()" class="print-btn no-print">🖨️ Nyomtatás</button>
        
        <!-- Work Number Display (Top Left) -->
        <div style="position: absolute; top: 20px; left: 20px; z-index: 100;">
            <div style="
                background: linear-gradient(135deg, #3B82F6, #1D4ED8);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-weight: bold;
                font-family: monospace;
                font-size: 16px;
                border: 2px solid #1E40AF;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                margin-bottom: 8px;
            ">
                MUNKA-#{{ work_order.work_number }}
            </div>
            <div style="
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                border: 2px solid #047857;
            ">
                📅 {{ work_order.created_at.strftime('%Y.%m.%d') }}
            </div>
        </div>

        <div class="header">
            <div class="company-info">
                <h1>🔧 TURBÓ SZERVIZ</h1>
                <p style="color: #6B7280; font-size: 1.1em; margin: 5px 0;">Turbófeltöltő javítás és karbantartás</p>
            </div>
            <div class="work-number">MUNKALAP #{{ work_order.work_number }}</div>
        </div>

        <div class="grid">
            <div class="column">
                <div class="section">
                    <h3>👤 Ügyfél adatok</h3>
                    <div class="info-row">
                        <span class="label">Név:</span>
                        <span class="value">{{ client.name }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Telefon:</span>
                        <span class="value">{{ client.phone }}</span>
                    </div>
                    {% if client.address %}
                    <div class="info-row">
                        <span class="label">Cím:</span>
                        <span class="value">{{ client.address }}</span>
                    </div>
                    {% endif %}
                    {% if client.company_name %}
                    <div class="info-row">
                        <span class="label">Cégnév:</span>
                        <span class="value">{{ client.company_name }}</span>
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <div class="column">
                <div class="section">
                    <h3>🚗 Jármű adatok</h3>
                    <div class="info-row">
                        <span class="label">Márka:</span>
                        <span class="value">{{ work_order.car_make }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Típus:</span>
                        <span class="value">{{ work_order.car_model }}</span>
                    </div>
                    {% if work_order.car_year %}
                    <div class="info-row">
                        <span class="label">Évjárat:</span>
                        <span class="value">{{ work_order.car_year }}</span>
                    </div>
                    {% endif %}
                    {% if work_order.engine_code %}
                    <div class="info-row">
                        <span class="label">Motorkód:</span>
                        <span class="value">{{ work_order.engine_code }}</span>
                    </div>
                    {% endif %}
                </div>
            </div>
        </div>

        <div class="section">
            <h3>🔧 Turbó információk</h3>
            <div class="info-row">
                <span class="label">Turbó kód:</span>
                <span class="value" style="font-family: monospace; font-size: 1.1em; font-weight: bold;">{{ work_order.turbo_code }}</span>
            </div>
            <div class="info-row">
                <span class="label">Beérkezés dátuma:</span>
                <span class="value">{{ work_order.received_date }}</span>
            </div>
            {% if work_order.general_notes %}
            <div class="info-row">
                <span class="label">Megjegyzések:</span>
                <span class="value">{{ work_order.general_notes }}</span>
            </div>
            {% endif %}
        </div>

        <div class="grid">
            <div class="column">
                <div class="section">
                    <h3>📊 Státusz információk</h3>
                    <div style="text-align: center; margin: 15px 0;">
                        <div class="status {{ work_order.status }}">{{ status_text }}</div>
                    </div>
                    <div class="info-row">
                        <span class="label">Árajánlat küldve:</span>
                        <span class="value">{{ "✅ Igen" if work_order.quote_sent else "❌ Nem" }}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Árajánlat elfogadva:</span>
                        <span class="value">{{ "✅ Igen" if work_order.quote_accepted else "❌ Nem" }}</span>
                    </div>
                    {% if work_order.estimated_completion %}
                    <div class="info-row">
                        <span class="label">Becsült készre kerülés:</span>
                        <span class="value">{{ work_order.estimated_completion }}</span>
                    </div>
                    {% endif %}
                </div>
            </div>
            
            <div class="column">
                <div class="section pricing">
                    <h3>💰 Árazás</h3>
                    <div class="info-row">
                        <span class="label">Tisztítás:</span>
                        <span class="value">{{ "{:,.0f}".format(work_order.cleaning_price) }} LEI</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Felújítás:</span>
                        <span class="value">{{ "{:,.0f}".format(work_order.reconditioning_price) }} LEI</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Turbó:</span>
                        <span class="value">{{ "{:,.0f}".format(work_order.turbo_price) }} LEI</span>
                    </div>
                    <div class="total">
                        Összesen: {{ "{:,.0f}".format(total_amount) }} LEI
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p><strong>Munkalap generálva:</strong> {{ now.strftime("%Y-%m-%d %H:%M:%S") }}</p>
            <p>🔧 <strong>Turbó Szerviz Kezelő Rendszer</strong></p>
        </div>
        
        <script>
            // Auto print dialog on page load if requested
            if (window.location.search.includes('autoprint=true')) {
                window.print();
            }
        </script>
    </body>
    </html>
    """
    
    # Status translations
    status_translations = {
        'RECEIVED': 'Beérkezett',
        'IN_PROGRESS': 'Vizsgálat alatt',
        'QUOTED': 'Árajánlat készült',
        'ACCEPTED': 'Elfogadva',
        'REJECTED': 'Elutasítva',
        'WORKING': 'Javítás alatt',
        'READY': 'Kész',
        'DELIVERED': 'Átvett'
    }
    
    # Add new status translations
    status_translations['DRAFT'] = 'Piszkozat'
    status_translations['FINALIZED'] = 'Véglegesítve'
    
    # Calculate total amount
    total_amount = work_order.get("cleaning_price", 0) + work_order.get("reconditioning_price", 0) + work_order.get("turbo_price", 0)
    
    # Render template
    template = Template(html_template)
    html_content = template.render(
        work_order=work_order,
        client=client,
        status_text=status_translations.get(work_order["status"], work_order["status"]),
        total_amount=total_amount,
        now=datetime.utcnow()
    )
    
    return HTMLResponse(content=html_content)

@api_router.get("/work-orders/{work_order_id}/print-data")
async def get_work_order_print_data(work_order_id: str):
    """Get print data for work order"""
    work_order = await db.work_orders.find_one({"id": work_order_id})
    if not work_order:
        raise HTTPException(status_code=404, detail="Munkalap nem található")
    
    client = await db.clients.find_one({"id": work_order["client_id"]})
    if not client:
        raise HTTPException(status_code=404, detail="Ügyfél nem található")
    
    return {
        "work_order": work_order,
        "client": client
    }


# GitHub Project Backend API Adaptation
from enum import Enum

class MovementType(str, Enum):
    IN = "IN"
    OUT = "OUT"

class WorkStatus(str, Enum):
    DRAFT = "DRAFT"
    RECEIVED = "RECEIVED"
    IN_PROGRESS = "IN_PROGRESS"
    QUOTED = "QUOTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WORKING = "WORKING"
    READY = "READY"
    DELIVERED = "DELIVERED"
    FINALIZED = "FINALIZED"

# Part Types
class PartType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PartTypeCreate(BaseModel):
    name: str

# Suppliers
class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SupplierCreate(BaseModel):
    name: str

# Parts (Inventory Items adapted)
class Part(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    part_type_id: str
    supplier_id: str
    notes: str = ""
    stock_quantity: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PartCreate(BaseModel):
    code: str
    part_type_id: str
    supplier_id: str
    notes: str = ""

class PartUpdate(BaseModel):
    code: Optional[str] = None
    part_type_id: Optional[str] = None
    supplier_id: Optional[str] = None
    notes: Optional[str] = None

class StockMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    part_id: str
    movement_type: MovementType
    quantity: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

class StockMovementCreate(BaseModel):
    part_id: str
    movement_type: MovementType
    quantity: int

class PartWithDetails(BaseModel):
    id: str
    code: str
    part_type_name: str
    supplier_name: str
    notes: str
    stock_quantity: int
    created_at: datetime
    updated_at: datetime

# Keep old models for compatibility
class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                          # pl. "Geometria"
    code: str                          # pl. "GEO-001" 
    category: str = "general"          # pl. "turbo_parts", "tools", "consumables"
    current_stock: int = 0             # Jelenlegi készlet
    min_stock: int = 0                 # Minimum készlet (riasztáshoz)
    max_stock: int = 1000              # Maximum készlet
    unit: str = "db"                   # Mértékegység
    location: Optional[str] = ""       # Raktári helyszín
    supplier: Optional[str] = ""       # Szállító
    purchase_price: float = 0.0        # Beszerzési ár
    notes: Optional[str] = ""          # Megjegyzések
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryItemCreate(BaseModel):
    name: str
    code: str
    category: str = "general"
    current_stock: int = 0
    min_stock: int = 0
    max_stock: int = 1000
    unit: str = "db"
    location: Optional[str] = ""
    supplier: Optional[str] = ""
    purchase_price: float = 0.0
    notes: Optional[str] = ""

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    min_stock: Optional[int] = None
    max_stock: Optional[int] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    supplier: Optional[str] = None
    purchase_price: Optional[float] = None
    notes: Optional[str] = None

class InventoryMovement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str                       # Hivatkozás InventoryItem-re
    movement_type: str                 # "IN", "OUT", "ADJUSTMENT"
    quantity: int                      # +/- mennyiség
    reason: str                        # "purchase", "usage", "correction", "damaged"
    reference: Optional[str] = ""      # Hivatkozás (pl. work_order_id, invoice_number)
    notes: Optional[str] = ""          # Mozgás megjegyzése
    created_by: str = "System"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Készlet snapshot
    stock_before: int = 0              # Készlet mozgás előtt
    stock_after: int = 0               # Készlet mozgás után

class InventoryMovementCreate(BaseModel):
    item_id: str
    movement_type: str  # "IN", "OUT", "ADJUSTMENT"
    quantity: int
    reason: str
    reference: Optional[str] = ""
    notes: Optional[str] = ""

class InventoryItemWithStock(BaseModel):
    id: str
    name: str
    code: str
    category: str
    current_stock: int
    min_stock: int
    max_stock: int
    unit: str
    location: Optional[str]
    supplier: Optional[str]
    purchase_price: float
    notes: Optional[str]
    active: bool
    stock_status: str                  # "ok", "low", "critical", "overstock"
    last_movement: Optional[datetime] = None
    total_movements: int = 0


# Template Management endpoints
class WorksheetTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    category: str = "custom"
    config: dict
    created_by: str = "System"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_public: bool = False

class WorksheetTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str = "custom"
    config: dict
    is_public: bool = False

@api_router.post("/worksheet-templates", response_model=WorksheetTemplate)
async def create_worksheet_template(template: WorksheetTemplateCreate):
    """Create a new worksheet template"""
    template_obj = WorksheetTemplate(**template.dict())
    await db.worksheet_templates.insert_one(template_obj.dict())
    return template_obj

@api_router.get("/worksheet-templates", response_model=List[WorksheetTemplate])
async def get_worksheet_templates(category: Optional[str] = None, public_only: bool = False):
    """Get all worksheet templates"""
    query = {}
    if category:
        query["category"] = category
    if public_only:
        query["is_public"] = True
    
    templates = await db.worksheet_templates.find(query).sort("created_at", -1).to_list(1000)
    return [WorksheetTemplate(**template) for template in templates]

@api_router.get("/worksheet-templates/{template_id}", response_model=WorksheetTemplate)
async def get_worksheet_template(template_id: str):
    """Get specific worksheet template"""
    template = await db.worksheet_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    return WorksheetTemplate(**template)

@api_router.put("/worksheet-templates/{template_id}", response_model=WorksheetTemplate)
async def update_worksheet_template(template_id: str, template_update: WorksheetTemplateCreate):
    """Update worksheet template"""
    existing = await db.worksheet_templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    
    update_data = template_update.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    await db.worksheet_templates.update_one(
        {"id": template_id}, 
        {"$set": update_data}
    )
    
    updated = await db.worksheet_templates.find_one({"id": template_id})
    return WorksheetTemplate(**updated)

@api_router.delete("/worksheet-templates/{template_id}")
async def delete_worksheet_template(template_id: str):
    """Delete worksheet template"""
    result = await db.worksheet_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    return {"message": "Sablon törölve"}

@api_router.post("/worksheet-templates/{template_id}/export")
async def export_worksheet_template(template_id: str):
    """Export worksheet template as JSON"""
    from fastapi.responses import JSONResponse
    
    template = await db.worksheet_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Sablon nem található")
    
    export_data = {
        "name": template["name"],
        "description": template["description"],
        "category": template["category"],
        "config": template["config"],
        "exported_at": datetime.utcnow().isoformat(),
        "version": "1.0"
    }
    
    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f"attachment; filename={template['name'].replace(' ', '_')}_template.json"}
    )

@api_router.post("/worksheet-templates/import")
async def import_worksheet_template(template_data: dict):
    """Import worksheet template from JSON"""
    try:
        new_template = WorksheetTemplate(
            name=template_data.get("name", "Importált sablon"),
            description=template_data.get("description", "Importálva külső forrásból"),
            category="imported",
            config=template_data["config"],
            created_by="Import"
        )
        
        await db.worksheet_templates.insert_one(new_template.dict())
        return new_template
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Hiányzó mező: {e}")
    except Exception:
        raise HTTPException(status_code=400, detail="Hibás sablon formátum")


# Inventory Management Endpoints

@api_router.post("/inventory/items", response_model=InventoryItem)
async def create_inventory_item(item: InventoryItemCreate):
    """Create new inventory item"""
    # Check if code already exists
    existing = await db.inventory_items.find_one({"code": item.code})
    if existing:
        raise HTTPException(status_code=400, detail="Ez az alkatrész kód már létezik")
    
    item_obj = InventoryItem(**item.dict())
    await db.inventory_items.insert_one(item_obj.dict())
    return item_obj

@api_router.get("/inventory/items", response_model=List[InventoryItemWithStock])
async def get_inventory_items(
    search: Optional[str] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False
):
    """Get all inventory items with stock status"""
    query = {"active": True}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}}
        ]
    
    if category:
        query["category"] = category
    
    if low_stock_only:
        query["$expr"] = {"$lte": ["$current_stock", "$min_stock"]}
    
    items = await db.inventory_items.find(query).sort("name", 1).to_list(1000)
    
    result = []
    for item in items:
        # Calculate stock status
        stock_status = "ok"
        if item["current_stock"] <= 0:
            stock_status = "critical"
        elif item["current_stock"] <= item["min_stock"]:
            stock_status = "low"
        elif item["current_stock"] >= item["max_stock"]:
            stock_status = "overstock"
        
        # Get last movement and total movements
        last_movement = await db.inventory_movements.find_one(
            {"item_id": item["id"]}, 
            sort=[("created_at", -1)]
        )
        total_movements = await db.inventory_movements.count_documents({"item_id": item["id"]})
        
        result.append(InventoryItemWithStock(
            **item,
            stock_status=stock_status,
            last_movement=last_movement["created_at"] if last_movement else None,
            total_movements=total_movements
        ))
    
    return result

@api_router.get("/inventory/items/{item_id}", response_model=InventoryItem)
async def get_inventory_item(item_id: str):
    """Get specific inventory item"""
    item = await db.inventory_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    return InventoryItem(**item)

@api_router.put("/inventory/items/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, item_update: InventoryItemUpdate):
    """Update inventory item"""
    existing = await db.inventory_items.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    
    update_data = {k: v for k, v in item_update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.inventory_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await db.inventory_items.find_one({"id": item_id})
    return InventoryItem(**updated)

@api_router.delete("/inventory/items/{item_id}")
async def delete_inventory_item(item_id: str):
    """Delete inventory item (soft delete)"""
    result = await db.inventory_items.update_one(
        {"id": item_id}, 
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    return {"message": "Alkatrész törölve"}

@api_router.post("/inventory/movements", response_model=InventoryMovement)
async def create_inventory_movement(movement: InventoryMovementCreate):
    """Create inventory movement (IN/OUT)"""
    # Get current item
    item = await db.inventory_items.find_one({"id": movement.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    
    # Calculate new stock
    stock_before = item["current_stock"]
    
    if movement.movement_type == "OUT" and movement.quantity > 0:
        movement.quantity = -movement.quantity  # Convert to negative for OUT
    
    stock_after = stock_before + movement.quantity
    
    # Validate stock doesn't go negative
    if stock_after < 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Nincs elegendő készlet. Jelenlegi: {stock_before}, kért: {abs(movement.quantity)}"
        )
    
    # Create movement record
    movement_obj = InventoryMovement(
        **movement.dict(),
        stock_before=stock_before,
        stock_after=stock_after
    )
    await db.inventory_movements.insert_one(movement_obj.dict())
    
    # Update item stock
    await db.inventory_items.update_one(
        {"id": movement.item_id},
        {
            "$set": {
                "current_stock": stock_after,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return movement_obj

@api_router.get("/inventory/movements", response_model=List[InventoryMovement])
async def get_inventory_movements(
    item_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100
):
    """Get inventory movements"""
    query = {}
    if item_id:
        query["item_id"] = item_id
    if movement_type:
        query["movement_type"] = movement_type
    
    movements = await db.inventory_movements.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [InventoryMovement(**movement) for movement in movements]

@api_router.get("/inventory/dashboard")
async def get_inventory_dashboard():
    """Get inventory dashboard statistics"""
    # Total items
    total_items = await db.inventory_items.count_documents({"active": True})
    
    # Low stock items
    low_stock_items = await db.inventory_items.count_documents({
        "active": True,
        "$expr": {"$lte": ["$current_stock", "$min_stock"]}
    })
    
    # Out of stock items
    out_of_stock_items = await db.inventory_items.count_documents({
        "active": True,
        "current_stock": 0
    })
    
    # Recent movements (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_movements = await db.inventory_movements.count_documents({
        "created_at": {"$gte": seven_days_ago}
    })
    
    # Total stock value
    pipeline = [
        {"$match": {"active": True}},
        {
            "$addFields": {
                "total_value": {"$multiply": ["$current_stock", "$purchase_price"]}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_stock_value": {"$sum": "$total_value"}
            }
        }
    ]
    
    stock_value_result = await db.inventory_items.aggregate(pipeline).to_list(1)
    total_stock_value = stock_value_result[0]["total_stock_value"] if stock_value_result else 0
    
    return {
        "total_items": total_items,
        "low_stock_items": low_stock_items,
        "out_of_stock_items": out_of_stock_items,
        "recent_movements": recent_movements,
        "total_stock_value": total_stock_value,
        "last_updated": datetime.utcnow()
    }

# GitHub Project API Endpoints

# Alkatrésztípusok endpoints
@api_router.post("/part-types", response_model=PartType)
async def create_part_type(part_type: PartTypeCreate):
    existing = await db.part_types.find_one({"name": part_type.name})
    if existing:
        raise HTTPException(status_code=400, detail="Az alkatrésztípus már létezik")
    
    part_type_obj = PartType(**part_type.dict())
    await db.part_types.insert_one(part_type_obj.dict())
    return part_type_obj

@api_router.get("/part-types", response_model=List[PartType])
async def get_part_types():
    part_types = await db.part_types.find().to_list(1000)
    return [PartType(**pt) for pt in part_types]

@api_router.put("/part-types/{part_type_id}", response_model=PartType)
async def update_part_type(part_type_id: str, part_type: PartTypeCreate):
    existing = await db.part_types.find_one({"id": part_type_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Alkatrésztípus nem található")
    
    await db.part_types.update_one(
        {"id": part_type_id}, 
        {"$set": {"name": part_type.name}}
    )
    
    updated = await db.part_types.find_one({"id": part_type_id})
    return PartType(**updated)

@api_router.delete("/part-types/{part_type_id}")
async def delete_part_type(part_type_id: str):
    # Ellenőrizzük, hogy van-e alkatrész ezzel a típussal
    parts_with_type = await db.parts.find_one({"part_type_id": part_type_id})
    if parts_with_type:
        raise HTTPException(status_code=400, detail="Nem törölhető, mert vannak hozzá tartozó alkatrészek")
    
    result = await db.part_types.delete_one({"id": part_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alkatrésztípus nem található")
    
    return {"message": "Alkatrésztípus törölve"}

# Beszállítók endpoints  
@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier: SupplierCreate):
    existing = await db.suppliers.find_one({"name": supplier.name})
    if existing:
        raise HTTPException(status_code=400, detail="A beszállító már létezik")
    
    supplier_obj = Supplier(**supplier.dict())
    await db.suppliers.insert_one(supplier_obj.dict())
    return supplier_obj

@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers():
    suppliers = await db.suppliers.find().to_list(1000)
    return [Supplier(**s) for s in suppliers]

@api_router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, supplier: SupplierCreate):
    existing = await db.suppliers.find_one({"id": supplier_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Beszállító nem található")
    
    await db.suppliers.update_one(
        {"id": supplier_id}, 
        {"$set": {"name": supplier.name}}
    )
    
    updated = await db.suppliers.find_one({"id": supplier_id})
    return Supplier(**updated)

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str):
    # Ellenőrizzük, hogy van-e alkatrész ezzel a beszállítóval
    parts_with_supplier = await db.parts.find_one({"supplier_id": supplier_id})
    if parts_with_supplier:
        raise HTTPException(status_code=400, detail="Nem törölhető, mert vannak hozzá tartozó alkatrészek")
    
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Beszállító nem található")
    
    return {"message": "Beszállító törölve"}

# Alkatrészek endpoints (GitHub style)
@api_router.post("/parts", response_model=Part)
async def create_part(part: PartCreate):
    # Ellenőrizzük, hogy létezik-e a part_type és supplier
    part_type = await db.part_types.find_one({"id": part.part_type_id})
    if not part_type:
        raise HTTPException(status_code=400, detail="Alkatrésztípus nem található")
    
    supplier = await db.suppliers.find_one({"id": part.supplier_id})
    if not supplier:
        raise HTTPException(status_code=400, detail="Beszállító nem található")
    
    # Ellenőrizzük, hogy a kód egyedi legyen
    existing_code = await db.parts.find_one({"code": part.code})
    if existing_code:
        raise HTTPException(status_code=400, detail="Ez a kód már használatban van")
    
    part_obj = Part(**part.dict())
    await db.parts.insert_one(part_obj.dict())
    return part_obj

@api_router.get("/parts", response_model=List[PartWithDetails])
async def get_parts(search: Optional[str] = None):
    pipeline = [
        {
            "$lookup": {
                "from": "part_types",
                "localField": "part_type_id",
                "foreignField": "id",
                "as": "part_type"
            }
        },
        {
            "$lookup": {
                "from": "suppliers",
                "localField": "supplier_id",
                "foreignField": "id",
                "as": "supplier"
            }
        },
        {
            "$unwind": "$part_type"
        },
        {
            "$unwind": "$supplier"
        }
    ]
    
    if search:
        pipeline.append({
            "$match": {
                "$or": [
                    {"code": {"$regex": search, "$options": "i"}},
                    {"notes": {"$regex": search, "$options": "i"}},
                    {"part_type.name": {"$regex": search, "$options": "i"}},
                    {"supplier.name": {"$regex": search, "$options": "i"}}
                ]
            }
        })
    
    parts = await db.parts.aggregate(pipeline).to_list(1000)
    
    result = []
    for part in parts:
        result.append(PartWithDetails(
            id=part["id"],
            code=part["code"],
            part_type_name=part["part_type"]["name"],
            supplier_name=part["supplier"]["name"],
            notes=part.get("notes", ""),
            stock_quantity=part["stock_quantity"],
            created_at=part["created_at"],
            updated_at=part["updated_at"]
        ))
    
    return result

@api_router.put("/parts/{part_id}", response_model=Part)
async def update_part(part_id: str, part: PartUpdate):
    existing = await db.parts.find_one({"id": part_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    
    update_data = {}
    if part.code is not None:
        # Ellenőrizzük, hogy a kód egyedi legyen
        existing_code = await db.parts.find_one({"code": part.code, "id": {"$ne": part_id}})
        if existing_code:
            raise HTTPException(status_code=400, detail="Ez a kód már használatban van")
        update_data["code"] = part.code
    if part.part_type_id is not None:
        part_type = await db.part_types.find_one({"id": part.part_type_id})
        if not part_type:
            raise HTTPException(status_code=400, detail="Alkatrésztípus nem található")
        update_data["part_type_id"] = part.part_type_id
    if part.supplier_id is not None:
        supplier = await db.suppliers.find_one({"id": part.supplier_id})
        if not supplier:
            raise HTTPException(status_code=400, detail="Beszállító nem található")
        update_data["supplier_id"] = part.supplier_id
    if part.notes is not None:
        update_data["notes"] = part.notes
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await db.parts.update_one({"id": part_id}, {"$set": update_data})
    
    updated = await db.parts.find_one({"id": part_id})
    return Part(**updated)

@api_router.delete("/parts/{part_id}")
async def delete_part(part_id: str):
    result = await db.parts.delete_one({"id": part_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    
    # Töröljük a kapcsolódó készletmozgásokat is
    await db.stock_movements.delete_many({"part_id": part_id})
    
    return {"message": "Alkatrész törölve"}

# Készletmozgások endpoints
@api_router.post("/stock-movements", response_model=StockMovement)
async def create_stock_movement(movement: StockMovementCreate):
    # Ellenőrizzük, hogy létezik-e az alkatrész
    part = await db.parts.find_one({"id": movement.part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")
    
    # Ellenőrizzük, hogy van-e elég készlet OUT művelethez
    if movement.movement_type == MovementType.OUT:
        if part["stock_quantity"] < movement.quantity:
            raise HTTPException(status_code=400, detail="Nincs elég készlet a kiadáshoz")
    
    # Készletmozgás rögzítése
    movement_obj = StockMovement(**movement.dict())
    await db.stock_movements.insert_one(movement_obj.dict())
    
    # Készlet frissítése
    new_quantity = part["stock_quantity"]
    if movement.movement_type == MovementType.IN:
        new_quantity += movement.quantity
    else:
        new_quantity -= movement.quantity
    
    await db.parts.update_one(
        {"id": movement.part_id},
        {"$set": {"stock_quantity": new_quantity, "updated_at": datetime.utcnow()}}
    )
    
    return movement_obj

@api_router.get("/stock-movements/{part_id}", response_model=List[StockMovement])
async def get_stock_movements(part_id: str):
    movements = await db.stock_movements.find({"part_id": part_id}).sort("created_at", -1).to_list(1000)
    return [StockMovement(**m) for m in movements]

# Inicializáló adatok betöltése (GitHub style)
@api_router.post("/initialize-data")
async def initialize_data():
    # Alkatrésztípusok inicializálása
    part_types = [
        "Ansamblu central (CHRA)",
        "Geometria",
        "Set garnitura", 
        "Nozle Ring Cage"
    ]
    
    for pt_name in part_types:
        existing = await db.part_types.find_one({"name": pt_name})
        if not existing:
            pt_obj = PartType(name=pt_name)
            await db.part_types.insert_one(pt_obj.dict())
    
    # Beszállítók inicializálása
    suppliers = ["Melett", "Vallion", "Cer"]
    
    for s_name in suppliers:
        existing = await db.suppliers.find_one({"name": s_name})
        if not existing:
            s_obj = Supplier(name=s_name)
            await db.suppliers.insert_one(s_obj.dict())
    
    return {"message": "Alapadatok inicializálva"}



@api_router.post("/inventory/initialize-default-items")
async def initialize_default_inventory():
    """Initialize default inventory items"""
    default_items = [
        {
            "name": "Geometria",
            "code": "GEO-001",
            "category": "turbo_parts",
            "current_stock": 5,
            "min_stock": 2,
            "unit": "db",
            "purchase_price": 85.0
        },
        {
            "name": "C.H.R.A",
            "code": "CHRA-001", 
            "category": "turbo_parts",
            "current_stock": 3,
            "min_stock": 1,
            "unit": "db",
            "purchase_price": 450.0
        },
        {
            "name": "Aktuátor",
            "code": "ACT-001",
            "category": "turbo_parts",
            "current_stock": 8,
            "min_stock": 3,
            "unit": "db",
            "purchase_price": 120.0
        },
        {
            "name": "Javító készlet",
            "code": "SET-001",
            "category": "turbo_parts",
            "current_stock": 15,
            "min_stock": 5,
            "unit": "db",
            "purchase_price": 25.0
        },
        {
            "name": "Tisztítószer",
            "code": "CLEAN-001",
            "category": "consumables",
            "current_stock": 2,
            "min_stock": 1,
            "unit": "liter",
            "purchase_price": 15.0
        }
    ]
    
    created_count = 0
    for item_data in default_items:
        existing = await db.inventory_items.find_one({"code": item_data["code"]})
        if not existing:
            item_obj = InventoryItem(**item_data)
            await db.inventory_items.insert_one(item_obj.dict())
            created_count += 1
    
    return {"message": f"{created_count} alapértelmezett alkatrész hozzáadva"}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()