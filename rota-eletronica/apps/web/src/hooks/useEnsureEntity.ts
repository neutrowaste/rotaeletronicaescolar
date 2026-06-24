import { useEffect, useState } from 'react';
import { useDriversStore } from '@/store/driversStore';
import { useVehiclesStore } from '@/store/vehiclesStore';
import { useStudentsStore } from '@/store/studentsStore';
import { useMunicipalitiesStore } from '@/store/municipalitiesStore';

/** Garante motorista no cache global; re-render quando `items` atualizar. */
export function useDriverEntity(id: string | undefined) {
  const driver = useDriversStore((s) => (id ? s.items.find((d) => d.id === id) : undefined));
  const fetchDriverById = useDriversStore((s) => s.fetchDriverById);
  const [resolved, setResolved] = useState(!id);

  useEffect(() => {
    if (!id) {
      setResolved(true);
      return;
    }
    if (driver) {
      setResolved(true);
      return;
    }
    setResolved(false);
    void fetchDriverById(id).finally(() => setResolved(true));
  }, [id, driver, fetchDriverById]);

  return { driver, loading: !!id && !resolved };
}

export function useVehicleEntity(id: string | undefined) {
  const vehicle = useVehiclesStore((s) => (id ? s.items.find((v) => v.id === id) : undefined));
  const fetchVehicleById = useVehiclesStore((s) => s.fetchVehicleById);
  const [resolved, setResolved] = useState(!id);

  useEffect(() => {
    if (!id) {
      setResolved(true);
      return;
    }
    if (vehicle) {
      setResolved(true);
      return;
    }
    setResolved(false);
    void fetchVehicleById(id).finally(() => setResolved(true));
  }, [id, vehicle, fetchVehicleById]);

  return { vehicle, loading: !!id && !resolved };
}

export function useStudentEntity(id: string | undefined) {
  const student = useStudentsStore((s) => (id ? s.items.find((st) => st.id === id) : undefined));
  const fetchStudentById = useStudentsStore((s) => s.fetchStudentById);
  const [resolved, setResolved] = useState(!id);

  useEffect(() => {
    if (!id) {
      setResolved(true);
      return;
    }
    if (student) {
      setResolved(true);
      return;
    }
    setResolved(false);
    void fetchStudentById(id).finally(() => setResolved(true));
  }, [id, student, fetchStudentById]);

  return { student, loading: !!id && !resolved };
}

export function useMunicipalityEntity(id: string | undefined) {
  const municipality = useMunicipalitiesStore((s) =>
    id ? s.items.find((m) => m.id === id) : undefined
  );
  const fetchMunicipalityById = useMunicipalitiesStore((s) => s.fetchMunicipalityById);
  const [resolved, setResolved] = useState(!id);

  useEffect(() => {
    if (!id) {
      setResolved(true);
      return;
    }
    if (municipality) {
      setResolved(true);
      return;
    }
    setResolved(false);
    void fetchMunicipalityById(id).finally(() => setResolved(true));
  }, [id, municipality, fetchMunicipalityById]);

  return { municipality, loading: !!id && !resolved };
}
