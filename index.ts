export interface Student {
    id: string;
    name: string;
    rollNumber: string;
    department: string | null;
    createdAt: string;
}

export interface Attendance {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late';
    studentId: string;
    student?: Student;
}
