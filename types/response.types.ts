export interface GetHomesApiResponse {
  data: HomeBody[]
}

export interface HomeBody {
  id: string
  name: string
  created_at: string
}
