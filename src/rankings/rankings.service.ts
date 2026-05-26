import { Injectable, InternalServerErrorException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../lib/prisma.service.js';
import { QueryRankingDto } from './dto/query-ranking.dto';
import { Jurusan } from '../../generated/prisma/client';

@Injectable()
export class RankingsService {
  private readonly prisma = PrismaService;

  async generateRanking() {
    try {
      // Fetch all students who have both raporScores and nilaiScore
      const students = await this.prisma.students.findMany({
        where: {
          raporScores: { some: {} },
          nilaiScore: { isNot: null },
        },
        include: {
          raporScores: true,
          nilaiScore: true,
        },
      });

      // Prepare data for student_ranking
      const rankingDataMap = new Map<Jurusan, Array<{ id_student: number; final_score: number; jurusan: Jurusan; ranking: number }>>();

      for (const student of students) {
        const rapor = student.raporScores[0];
        const test = student.nilaiScore;

        if (!rapor || !test) continue;

        const raporAverage = rapor.rata_rata || 0;
        const testAverage = test.average_score || 0;
        
        // final_score = (rapor_average * 0.4) + (test_average * 0.6)
        const finalScore = (raporAverage * 0.4) + (testAverage * 0.6);

        if (!rankingDataMap.has(student.jurusan)) {
          rankingDataMap.set(student.jurusan, []);
        }

        rankingDataMap.get(student.jurusan)!.push({
          id_student: student.id,
          final_score: finalScore,
          jurusan: student.jurusan,
          ranking: 0,
        });
      }

      // Sort and assign rankings per jurusan
      const allNewRankings: Array<{ id_student: number; final_score: number; jurusan: Jurusan; ranking: number }> = [];

      for (const [jurusan, data] of rankingDataMap.entries()) {
        // Sort descending by final_score
        data.sort((a, b) => b.final_score - a.final_score);
        
        // Assign rank
        data.forEach((item, index) => {
          item.ranking = index + 1;
          allNewRankings.push(item);
        });
      }

      // Execute transaction to delete old and insert new rankings
      await this.prisma.$transaction(async (tx) => {
        await tx.student_ranking.deleteMany({});
        
        if (allNewRankings.length > 0) {
          await tx.student_ranking.createMany({
            data: allNewRankings,
          });
        }
      });

      return {
        success: true,
        message: 'Berhasil meng-generate ranking',
        data: {
          total_processed: allNewRankings.length,
        }
      };

    } catch (error) {
      console.error('Error generateRanking:', error);
      throw new InternalServerErrorException('Gagal meng-generate ranking');
    }
  }

  async getRankings(query: QueryRankingDto) {
    try {
      const { page = 1, limit = 10, jurusan } = query;
      const skip = (page - 1) * limit;

      const where = jurusan ? { jurusan } : {};

      const [total, data] = await this.prisma.$transaction([
        this.prisma.student_ranking.count({ where }),
        this.prisma.student_ranking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { ranking: 'asc' },
          include: {
            student: {
              select: {
                id: true,
                nama: true,
                no_daftar: true,
                nisn: true,
                asal_sekolah: true,
              }
            }
          }
        }),
      ]);

      return {
        success: true,
        message: 'Berhasil mengambil data ranking',
        metadata: {
          statusCode: HttpStatus.OK,
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
        data: data.map(item => ({
          id: item.id,
          id_student: item.id_student,
          nama: item.student.nama,
          no_daftar: item.student.no_daftar,
          jurusan: item.jurusan,
          final_score: item.final_score,
          ranking: item.ranking,
        })),
      };
    } catch (error) {
      console.error('Error getRankings:', error);
      throw new InternalServerErrorException('Gagal mengambil data ranking');
    }
  }
}
