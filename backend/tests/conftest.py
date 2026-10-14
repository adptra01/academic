"""Test configuration and fixtures."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.core.db import Base, get_db
from app.main import app
from app.models import User, Project, Dataset, DatasetVersion, ResearchIntent, AnalysisConfig, Analysis, AnalysisResult, ResearchLog
from app.core.security import create_token


# Use PostgreSQL test database (same as ddev)
TEST_DATABASE_URL = "postgresql+psycopg://db:db@db:5432/db"


@pytest.fixture(scope="session")
def engine():
    """Create test database engine."""
    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(engine) -> Session:
    """Create a fresh database session for each test."""
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, expire_on_commit=False)
    session = SessionLocal()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> TestClient:
    """Create test client with DB session override."""
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session: Session) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        password_hash="hashed",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(test_user: User) -> dict:
    """Create auth headers for test user."""
    token = create_token(str(test_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def test_project(db_session: Session, test_user: User) -> Project:
    """Create a test project."""
    proj = Project(
        user_id=test_user.id,
        title="Test Project",
        description="Test project for guided flow"
    )
    db_session.add(proj)
    db_session.commit()
    db_session.refresh(proj)
    return proj


@pytest.fixture(scope="function")
def test_dataset(db_session: Session, test_project: Project) -> Dataset:
    """Create a test dataset with sample data."""
    import pandas as pd
    import tempfile
    import os

    # Create sample CSV
    df = pd.DataFrame({
        "id": range(1, 31),
        "group": ["A", "B"] * 15,
        "score": [10, 12, 11, 13, 14, 15, 16, 17, 18, 19,
                  20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
                  30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
        "age": [20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
                30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
                40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
        "gender": ["M", "F"] * 15
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f.name, index=False)
        storage_path = f.name

    ds = Dataset(
        project_id=test_project.id,
        filename="sample.csv",
        storage_path=storage_path,
        file_type="csv",
        size_bytes=os.path.getsize(storage_path),
        rows_count=30,
        cols_count=4
    )
    db_session.add(ds)
    db_session.commit()
    db_session.refresh(ds)

    # Create version
    dv = DatasetVersion(
        dataset_id=ds.id,
        version_number=1,
        transformation_log=[],
        storage_path=None
    )
    db_session.add(dv)
    db_session.commit()
    db_session.refresh(dv)

    yield ds

    # Cleanup
    if os.path.exists(storage_path):
        os.unlink(storage_path)


@pytest.fixture(scope="function")
def test_dataset_version(db_session: Session, test_dataset: Dataset) -> DatasetVersion:
    """Get the dataset version."""
    dv = db_session.query(DatasetVersion).filter(DatasetVersion.dataset_id == test_dataset.id).first()
    return dv