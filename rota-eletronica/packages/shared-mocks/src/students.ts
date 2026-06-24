import type { Student, Coordinates } from '@rota-eletronica/shared-types';
import { schools } from './schools';

const FIRST_NAMES = [
  'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Gabriel', 'Fernanda', 'Rafael', 'Camila',
  'Bruno', 'Larissa', 'Felipe', 'Amanda', 'Leonardo', 'Beatriz', 'Matheus', 'Isabela', 'Gustavo', 'Mariana',
  'Daniel', 'Carolina', 'Thiago', 'Leticia', 'Rodrigo', 'Patricia', 'Marcos', 'Aline', 'André', 'Renata',
  'Eduardo', 'Vanessa', 'Carlos', 'Juliana', 'Paulo', 'Cristina', 'Ricardo', 'Sandra', 'Fernando', 'Claudia',
  'Luciano', 'Adriana', 'Vinícius', 'Elaine', 'Diego', 'Mônica', 'Alexandre', 'Simone', 'Roberto', 'Carla',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Rocha', 'Almeida', 'Nascimento', 'Araújo', 'Mendes', 'Castro',
  'Dias', 'Nunes', 'Barbosa', 'Teixeira', 'Moreira', 'Cardoso', 'Correia', 'Campos', 'Lopes', 'Vieira',
];

const GRADES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano'];
const SHIFTS = ['morning', 'afternoon', 'integral'] as const;
const RELATIONSHIPS = ['Pai', 'Mãe', 'Avô', 'Avó', 'Tio', 'Tia', 'Responsável legal'];

/** Gera coordenadas com pequeno deslocamento (simula endereços próximos à escola) */
function offsetCoord(base: Coordinates, dx: number, dy: number): Coordinates {
  return {
    lat: base.lat + dx * 0.008 + (Math.random() - 0.5) * 0.003,
    lng: base.lng + dy * 0.008 + (Math.random() - 0.5) * 0.003,
  };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

let regCounter = 10001;

/** Gera 200 alunos distribuídos entre as escolas e municípios */
function buildStudents(): Student[] {
  const result: Student[] = [];
  const schoolList = [...schools];
  let studentIndex = 0;

  for (let i = 0; i < 200; i++) {
    const school = schoolList[i % schoolList.length];
    const municipalityId = school.municipalityId;
    const base = school.coordinates;
    const shift = pick(SHIFTS);
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const regNum = String(regCounter++);
    const birthDate = randomDate(new Date(2010, 0, 1), new Date(2018, 11, 31));
    const grade = pick(GRADES);
    const boarding = offsetCoord(base, 1, 1);
    const alighting = offsetCoord(base, -0.5, -0.5);
    const respName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const specialNeeds = Math.random() < 0.08;

    result.push({
      id: `STU${String(studentIndex + 1).padStart(3, '0')}`,
      name,
      registrationNumber: regNum,
      birthDate,
      grade,
      shift,
      schoolId: school.id,
      municipalityId,
      address: `Rua Exemplo ${100 + (i % 50)}, Bairro Centro`,
      boardingPoint: {
        address: `Rua Embarque ${i + 1}, próximo à escola`,
        coordinates: boarding,
      },
      alightingPoint: {
        address: school.address,
        coordinates: { ...school.coordinates },
      },
      responsible: {
        name: respName,
        relationship: pick(RELATIONSHIPS),
        cpf: `${String(100 + (i % 900)).padStart(3, '0')}.${String(100 + (i % 900)).padStart(3, '0')}.${String(100 + (i % 900)).padStart(3, '0')}-${String(10 + (i % 90)).padStart(2, '0')}`,
        phone: `(19) 9${String(8000 + (i % 2000)).padStart(4, '0')}-${String(1000 + (i % 9000)).padStart(4, '0')}`,
        email: `resp.${regNum}@email.com`,
      },
      specialNeeds,
      specialNeedsDescription: specialNeeds ? 'Acompanhamento pedagógico' : undefined,
      routeId: null,
      status: Math.random() < 0.92 ? 'active' : Math.random() < 0.5 ? 'inactive' : 'transferred',
      photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    });
    studentIndex++;
  }

  return result;
}

export const students: Student[] = buildStudents();
