import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateNilaiScoreDto } from './dto/create-nilai-score.dto';
import { UpdateNilaiScoreDto } from './dto/update-nilai-score.dto';
import { QueryNilaiScoreDto } from './dto/query-nilai-score.dto';
import { PrismaService } from '../lib/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class NilaiScoresService {
  async create(createNilaiScoreDto: CreateNilaiScoreDto) {
    const {
      student_id,
      math_score,
      indonesia_score,
      english_score,
      religion_score,
    } = createNilaiScoreDto;

    // Check if student exists
    const student = await PrismaService.students.findUnique({
      where: { id: student_id },
    });

    if (!student) {
      throw new NotFoundException(
        `Student dengan ID ${student_id} tidak ditemukan`,
      );
    }

    // Check if score already exists
    const existingScore = await PrismaService.nilai_scores.findUnique({
      where: { student_id },
    });

    if (existingScore) {
      throw new ConflictException('Student sudah memiliki data nilai');
    }

    // Calculate average score
    const average_score =
      (math_score + indonesia_score + english_score + religion_score) / 4;

    const newScore = await PrismaService.nilai_scores.create({
      data: {
        student_id,
        math_score,
        indonesia_score,
        english_score,
        religion_score,
        average_score,
      },
      include: {
        student: true,
      },
    });

    return newScore;
  }

  async findAll(query: QueryNilaiScoreDto) {
    const { page = 1, limit = 10, search, major } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.nilai_scoresWhereInput = {};

    if (search || major) {
      whereClause.student = {};
      if (search) {
        whereClause.student.nama = {
          contains: search,
        };
      }
      if (major) {
        whereClause.student.jurusan = major;
      }
    }

    const [total, data] = await Promise.all([
      PrismaService.nilai_scores.count({ where: whereClause }),
      PrismaService.nilai_scores.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          student: true,
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
      },
    };
  }

  async findScoreStatus(query: QueryNilaiScoreDto) {
    const { page = 1, limit = 10, search, major, isScored } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.studentsWhereInput = {};

    if (search) {
      whereClause.nama = {
        contains: search,
      };
    }
    if (major) {
      whereClause.jurusan = major as any;
    }

    if (isScored !== undefined) {
      if (isScored) {
        whereClause.nilaiScore = {
          isNot: null,
        };
      } else {
        whereClause.nilaiScore = {
          is: null,
        };
      }
    }

    const [total, data] = await Promise.all([
      PrismaService.students.count({ where: whereClause }),
      PrismaService.students.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        include: {
          nilaiScore: true,
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: string) {
    const score = await PrismaService.nilai_scores.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!score) {
      throw new NotFoundException(`Data nilai dengan ID ${id} tidak ditemukan`);
    }

    return score;
  }

  async findAllByJurusan(jurusan: string) {
    const score = await PrismaService.nilai_scores.findMany({
      where: { student: { jurusan: jurusan as any } },
      include: {
        student: true,
      },
    });

    return score;
  }

  async findByStudentId(studentId: number) {
    const score = await PrismaService.nilai_scores.findUnique({
      where: { student_id: studentId },
      include: {
        student: true,
      },
    });

    if (!score) {
      throw new NotFoundException(
        `Data nilai untuk student ID ${studentId} tidak ditemukan`,
      );
    }

    return score;
  }

  async update(id: string, updateNilaiScoreDto: UpdateNilaiScoreDto) {
    const existingScore = await this.findOne(id);

    const math = updateNilaiScoreDto.math_score ?? existingScore.math_score;
    const indonesia =
      updateNilaiScoreDto.indonesia_score ?? existingScore.indonesia_score;
    const english =
      updateNilaiScoreDto.english_score ?? existingScore.english_score;
    const religion =
      updateNilaiScoreDto.religion_score ?? existingScore.religion_score;

    const average_score = (math + indonesia + english + religion) / 4;

    const updatedScore = await PrismaService.nilai_scores.update({
      where: { id },
      data: {
        ...updateNilaiScoreDto,
        average_score,
      },
      include: {
        student: true,
      },
    });

    return updatedScore;
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure it exists

    await PrismaService.nilai_scores.delete({
      where: { id },
    });

    return { success: true, message: 'Nilai berhasil dihapus' };
  }
}
