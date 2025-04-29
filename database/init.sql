-- Създаване на базата данни
CREATE DATABASE flatmoney;

-- Свързване с базата данни
\c flatmoney;

-- Изтриваме таблиците ако съществуват
DROP TABLE IF EXISTS building_access CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Създаваме таблица за потребители
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Създаваме таблица за сгради
CREATE TABLE buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    total_floors INTEGER NOT NULL,
    description TEXT, -- Добавяме колона за описание
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id)
);

-- Създаваме таблица за достъп до сградите
CREATE TABLE building_access (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    building_id INTEGER REFERENCES buildings(id),
    is_owner BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, building_id)
);

-- Създаваме индекси
CREATE INDEX idx_buildings_created_by ON buildings(created_by);
CREATE INDEX idx_building_access_user ON building_access(user_id);
CREATE INDEX idx_building_access_building ON building_access(building_id);

-- Създаване на таблица за етажи
CREATE TABLE floors (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    total_apartments INTEGER NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(building_id, floor_number)
);

-- Създаване на таблица за апартаменти
CREATE TABLE apartments (
    id SERIAL PRIMARY KEY,
    floor_id INTEGER REFERENCES floors(id) ON DELETE CASCADE,
    apartment_number VARCHAR(50) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    area DECIMAL(10,2) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(floor_id, apartment_number)
);

-- Създаване на таблица за депозити
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Създаване на таблица за задължения
CREATE TABLE obligations (
    id SERIAL PRIMARY KEY,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    payment_date TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица за типове разходи
CREATE TABLE IF NOT EXISTS expense_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Таблица за разходи на сградата
CREATE TABLE IF NOT EXISTS building_expenses (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    expense_type_id INTEGER REFERENCES expense_types(id),
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вмъкване на основни типове разходи
INSERT INTO expense_types (name, description) VALUES
    ('Електричество', 'Разходи за електричество в общите части'),
    ('Вода', 'Разходи за вода в общите части'),
    ('Асансьор', 'Поддръжка и ремонт на асансьор'),
    ('Почистване', 'Разходи за почистване на общите части'),
    ('Ремонт', 'Разходи за ремонтни дейности'),
    ('Други', 'Други разходи')
ON CONFLICT DO NOTHING;

-- Създаване на индекси за по-бързо търсене
CREATE INDEX idx_floors_building_id ON floors(building_id);
CREATE INDEX idx_apartments_floor_id ON apartments(floor_id);
CREATE INDEX idx_deposits_apartment_id ON deposits(apartment_id);
CREATE INDEX idx_obligations_apartment_id ON obligations(apartment_id);

-- Добавяне на ограничения за валидация на данните
ALTER TABLE buildings ADD CONSTRAINT positive_total_floors CHECK (total_floors > 0);
ALTER TABLE floors ADD CONSTRAINT positive_floor_number CHECK (floor_number > 0);
ALTER TABLE floors ADD CONSTRAINT positive_total_apartments CHECK (total_apartments > 0);
ALTER TABLE apartments ADD CONSTRAINT positive_area CHECK (area > 0);
ALTER TABLE deposits ADD CONSTRAINT positive_amount CHECK (amount > 0);
ALTER TABLE obligations ADD CONSTRAINT positive_amount CHECK (amount > 0);